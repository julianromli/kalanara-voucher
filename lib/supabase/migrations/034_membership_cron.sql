-- ============================================================================
-- Nightly membership maintenance
-- Date: 2026-11-18
--
-- 02:00 Asia/Jakarta is 19:00 UTC. The job rolls due cycles and refreshes the
-- follow-up badge cache. Reads stay correct if this job never runs.
-- Do not change the existing heartbeat jobs.
-- ============================================================================

CREATE TABLE public.member_followup_due (
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  stage text NOT NULL,
  anchor_date date NOT NULL,
  computed_on date NOT NULL,
  PRIMARY KEY (member_id, stage, anchor_date),
  CONSTRAINT member_followup_due_stage_known CHECK (
    stage IN ('day30', 'day60', 'day90', 'day120', 'birthday')
  )
);

ALTER TABLE public.member_followup_due ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_followup_due FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.member_followup_due TO service_role;

CREATE FUNCTION public.member_nightly_maintenance()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  member_row record;
BEGIN
  FOR member_row IN
    SELECT members.id
    FROM public.members
    WHERE (members.cycle_start + interval '12 months')::date <= today
  LOOP
    PERFORM public.member_roll_cycle(member_row.id);
  END LOOP;

  DELETE FROM public.member_followup_due;

  INSERT INTO public.member_followup_due (
    member_id,
    stage,
    anchor_date,
    computed_on
  )
  SELECT
    due.member_id,
    due.stage,
    due.anchor_date,
    today
  FROM public.list_member_followups() AS due;
END;
$$;

REVOKE ALL ON FUNCTION public.member_nightly_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_nightly_maintenance() TO service_role;

DO $unschedule$
BEGIN
  PERFORM cron.unschedule(job.jobid)
  FROM cron.job AS job
  WHERE job.jobname = 'membership-nightly';
END
$unschedule$;

SELECT cron.schedule(
  'membership-nightly',
  '0 19 * * *',
  $$SELECT public.member_nightly_maintenance()$$
);

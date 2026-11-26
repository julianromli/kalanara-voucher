-- ============================================================================
-- Stamp corrections: void, change treatment, change visit date, add a past stamp
-- Date: 2026-11-26
--
-- Apply notes:
--   1. Apply this file before merging the stamp correction server actions.
--   2. Do not add anon or authenticated policies. Server code uses the
--      service-role client, same as membership tables in 033.
--   3. Do not apply from the app or CI. A person must run this on the
--      live project after review.
--
-- Rules:
--   - Every role that can add a stamp can correct one. The server action
--     checks MEMBERS_OPERATE before it calls these functions.
--   - A void is soft. member_stamps.voided_at and voided_by already exist
--     (033). Stamp counts, progress and level read only rows where
--     voided_at IS NULL, so they follow a void with no other change.
--   - Periods are fixed 12-month windows. The first one starts at the
--     member's origin: the sign-up date in Asia/Jakarta, or an earlier
--     cycle_start if one exists. Each next period starts 12 months after the
--     previous start, stepped one period at a time like member_preview_cycle,
--     so a 29 Feb start lines up with the nightly roll. A correction never
--     moves period dates.
--   - Stamps in any period can change, current or past. A visit date stays
--     inside its own period, is never before the origin, and is never after
--     today in Asia/Jakarta. A moved stamp keeps its period. A past stamp
--     that is added goes into the period its date falls in.
--   - Two stamps on one day need an explicit confirm, same as
--     member_add_stamp. There is no unique rule per day.
--   - A period holds at most 30 stamps, same as member_add_stamp.
--   - A void that drops a period's count below a reward already claimed in
--     that period returns needs_confirm_claimed. With p_confirm_claimed the
--     void goes through and the claim stays: the treatment was already given,
--     and the unique claim per period stops a second claim of the same reward.
--   - Rewards are claimed only in the current period (member_claim_reward).
--     A stamp added to a past period never opens a reward to claim.
--   - Level carry: at each reset the next period starts with
--     base_tier = max(level reached, carried base_tier) - 1. When a void or
--     an added stamp changes a past period's count, the carry is recomputed
--     from the origin with that same rule (as member_void_stamp does in 036)
--     and stored on the member. The current level can go up or down. The
--     result returns tier_before and tier_after for the current period.
--   - Each correction writes one member_stamp_audit row with the period,
--     who, role, email, when, old value, new value and an optional reason.
-- ============================================================================

CREATE TABLE public.member_stamp_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  stamp_id uuid NOT NULL REFERENCES public.member_stamps (id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value text,
  new_value text,
  service_name text NOT NULL,
  visit_date date NOT NULL,
  cycle_start date NOT NULL,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid,
  changed_by_email text,
  changed_by_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_stamp_audit_action_known CHECK (
    action IN ('void', 'service', 'visit_date', 'add_past')
  ),
  CONSTRAINT member_stamp_audit_reason_length CHECK (
    reason IS NULL OR char_length(reason) BETWEEN 1 AND 200
  )
);

CREATE INDEX member_stamp_audit_member_created_idx
  ON public.member_stamp_audit (member_id, created_at DESC);

CREATE INDEX member_stamp_audit_stamp_idx
  ON public.member_stamp_audit (stamp_id);

ALTER TABLE public.member_stamp_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_stamp_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.member_stamp_audit TO service_role;

-- First period start: the sign-up date, or an earlier cycle_start if any.
-- Same origin as member_void_stamp in 036.
CREATE FUNCTION public.member_origin_cycle(p_member_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT LEAST(
    (member.created_at AT TIME ZONE 'Asia/Jakarta')::date,
    member.cycle_start,
    COALESCE(
      (
        SELECT min(stamp.cycle_start)
        FROM public.member_stamps AS stamp
        WHERE stamp.member_id = member.id
      ),
      member.cycle_start
    )
  )
  FROM public.members AS member
  WHERE member.id = p_member_id;
$$;

-- Start of the period that holds p_date, stepping 12 months at a time from
-- the origin like member_preview_cycle. NULL when p_date is before the origin.
CREATE FUNCTION public.member_period_start_for(p_origin date, p_date date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start date := p_origin;
  v_steps integer := 0;
BEGIN
  IF p_origin IS NULL OR p_date IS NULL OR p_date < p_origin THEN
    RETURN NULL;
  END IF;

  LOOP
    EXIT WHEN p_date < (v_start + interval '12 months')::date;
    v_start := (v_start + interval '12 months')::date;
    v_steps := v_steps + 1;
    IF v_steps > 200 THEN
      RAISE EXCEPTION 'member_cycle_roll_limit';
    END IF;
  END LOOP;

  RETURN v_start;
END;
$$;

-- Checks a visit date. Returns NULL when allowed, otherwise the status to
-- return. p_period_end is exclusive (the reset date of that period).
CREATE FUNCTION public.member_stamp_date_problem(
  p_origin date,
  p_period_start date,
  p_period_end date,
  p_visit_date date
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_visit_date IS NULL THEN 'invalid_date'
    WHEN p_visit_date > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN 'future_date'
    WHEN p_visit_date < p_origin THEN 'before_signup'
    WHEN p_visit_date < p_period_start THEN 'outside_period'
    WHEN p_visit_date >= p_period_end THEN 'outside_period'
    ELSE NULL
  END;
$$;

-- Current level from a member row whose cycle is already rolled.
CREATE FUNCTION public.member_current_tier(p_member_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT GREATEST(
    public.member_tier_from_stamps(
      (
        SELECT count(*)::integer
        FROM public.member_stamps AS stamp
        WHERE stamp.member_id = member.id
          AND stamp.cycle_start = member.cycle_start
          AND stamp.voided_at IS NULL
      )
    ),
    member.base_tier
  )::smallint
  FROM public.members AS member
  WHERE member.id = p_member_id;
$$;

-- Recomputes the carried level after a past period changed. The caller
-- holds the member lock. Period dates come out the same; base_tier may change.
CREATE FUNCTION public.member_recompute_carry(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  preview record;
BEGIN
  SELECT *
  INTO preview
  FROM public.member_preview_cycle(
    p_member_id,
    public.member_origin_cycle(p_member_id),
    0::smallint,
    (now() AT TIME ZONE 'Asia/Jakarta')::date
  );

  UPDATE public.members
  SET
    cycle_start = preview.cycle_start,
    base_tier = preview.base_tier,
    updated_at = now()
  WHERE id = p_member_id;
END;
$$;

CREATE FUNCTION public.member_write_stamp_audit(
  p_member_id uuid,
  p_stamp_id uuid,
  p_action text,
  p_old_value text,
  p_new_value text,
  p_service_name text,
  p_visit_date date,
  p_cycle_start date,
  p_reason text,
  p_details jsonb,
  p_changed_by uuid,
  p_changed_by_email text,
  p_changed_by_role text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO public.member_stamp_audit (
    member_id,
    stamp_id,
    action,
    old_value,
    new_value,
    service_name,
    visit_date,
    cycle_start,
    reason,
    details,
    changed_by,
    changed_by_email,
    changed_by_role
  )
  VALUES (
    p_member_id,
    p_stamp_id,
    p_action,
    p_old_value,
    p_new_value,
    p_service_name,
    p_visit_date,
    p_cycle_start,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    COALESCE(p_details, '{}'::jsonb),
    p_changed_by,
    NULLIF(btrim(COALESCE(p_changed_by_email, '')), ''),
    NULLIF(btrim(COALESCE(p_changed_by_role, '')), '')
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

CREATE FUNCTION public.member_correct_void_stamp(
  p_stamp_id uuid,
  p_confirm_claimed boolean,
  p_reason text,
  p_changed_by uuid,
  p_changed_by_email text,
  p_changed_by_role text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stamp_member_id uuid;
  member_row public.members;
  stamp_row public.member_stamps;
  count_after integer;
  affected jsonb;
  past_period boolean;
  tier_before smallint;
  tier_after smallint;
BEGIN
  SELECT stamp.member_id
  INTO stamp_member_id
  FROM public.member_stamps AS stamp
  WHERE stamp.id = p_stamp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Member lock first, then the stamp lock, same order as member_void_stamp.
  member_row := public.member_roll_cycle(stamp_member_id);
  tier_before := public.member_current_tier(member_row.id);

  SELECT *
  INTO stamp_row
  FROM public.member_stamps
  WHERE id = p_stamp_id
  FOR UPDATE;

  IF stamp_row.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_voided');
  END IF;

  past_period := stamp_row.cycle_start < member_row.cycle_start;

  PERFORM 1
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = stamp_row.cycle_start
    AND stamp.voided_at IS NULL
  FOR UPDATE;

  SELECT count(*)::integer - 1
  INTO count_after
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = stamp_row.cycle_start
    AND stamp.voided_at IS NULL;

  -- Claims recorded in the stamp's own period, past or current.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('milestone', claim.milestone, 'reward_name', claim.reward_name)
      ORDER BY claim.milestone
    ),
    '[]'::jsonb
  )
  INTO affected
  FROM public.member_reward_claims AS claim
  WHERE claim.member_id = member_row.id
    AND claim.cycle_start = stamp_row.cycle_start
    AND claim.milestone > count_after;

  IF jsonb_array_length(affected) > 0 AND NOT COALESCE(p_confirm_claimed, false) THEN
    RETURN jsonb_build_object(
      'status', 'needs_confirm_claimed',
      'count_after', count_after,
      'cycle_start', stamp_row.cycle_start,
      'past_period', past_period,
      'claims', affected
    );
  END IF;

  UPDATE public.member_stamps
  SET
    voided_at = now(),
    voided_by = p_changed_by
  WHERE id = stamp_row.id;

  IF past_period THEN
    PERFORM public.member_recompute_carry(member_row.id);
  END IF;
  tier_after := public.member_current_tier(member_row.id);

  PERFORM public.member_write_stamp_audit(
    member_row.id,
    stamp_row.id,
    'void',
    'aktif',
    'dibatalkan',
    stamp_row.service_name,
    stamp_row.visit_date,
    stamp_row.cycle_start,
    p_reason,
    jsonb_build_object(
      'count_after', count_after,
      'claims_kept', affected,
      'tier_before', tier_before,
      'tier_after', tier_after
    ),
    p_changed_by,
    p_changed_by_email,
    p_changed_by_role
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', member_row.id,
    'count', count_after,
    'cycle_start', stamp_row.cycle_start,
    'past_period', past_period,
    'claims_kept', affected,
    'tier_before', tier_before,
    'tier_after', tier_after
  );
END;
$$;

CREATE FUNCTION public.member_correct_stamp_service(
  p_stamp_id uuid,
  p_service_id uuid,
  p_reason text,
  p_changed_by uuid,
  p_changed_by_email text,
  p_changed_by_role text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stamp_member_id uuid;
  member_row public.members;
  stamp_row public.member_stamps;
  next_name text;
BEGIN
  SELECT stamp.member_id
  INTO stamp_member_id
  FROM public.member_stamps AS stamp
  WHERE stamp.id = p_stamp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  member_row := public.member_roll_cycle(stamp_member_id);

  SELECT *
  INTO stamp_row
  FROM public.member_stamps
  WHERE id = p_stamp_id
  FOR UPDATE;

  IF stamp_row.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_voided');
  END IF;

  SELECT services.name
  INTO next_name
  FROM public.services
  WHERE services.id = p_service_id
    AND services.is_active = true;

  IF next_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_service');
  END IF;

  IF stamp_row.service_id IS NOT DISTINCT FROM p_service_id
    AND stamp_row.service_name IS NOT DISTINCT FROM next_name
  THEN
    RETURN jsonb_build_object('status', 'unchanged');
  END IF;

  UPDATE public.member_stamps
  SET
    service_id = p_service_id,
    service_name = next_name
  WHERE id = stamp_row.id;

  PERFORM public.member_write_stamp_audit(
    member_row.id,
    stamp_row.id,
    'service',
    stamp_row.service_name,
    next_name,
    next_name,
    stamp_row.visit_date,
    stamp_row.cycle_start,
    p_reason,
    '{}'::jsonb,
    p_changed_by,
    p_changed_by_email,
    p_changed_by_role
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', member_row.id,
    'service_name', next_name
  );
END;
$$;

CREATE FUNCTION public.member_correct_stamp_date(
  p_stamp_id uuid,
  p_visit_date date,
  p_confirm_same_day boolean,
  p_reason text,
  p_changed_by uuid,
  p_changed_by_email text,
  p_changed_by_role text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stamp_member_id uuid;
  member_row public.members;
  stamp_row public.member_stamps;
  origin date;
  period_end date;
  problem text;
  existing_stamp record;
BEGIN
  SELECT stamp.member_id
  INTO stamp_member_id
  FROM public.member_stamps AS stamp
  WHERE stamp.id = p_stamp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  member_row := public.member_roll_cycle(stamp_member_id);

  SELECT *
  INTO stamp_row
  FROM public.member_stamps
  WHERE id = p_stamp_id
  FOR UPDATE;

  IF stamp_row.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_voided');
  END IF;

  -- The stamp keeps its period. A past period also ends where the current
  -- one starts, so a moved stamp can never land inside the current period.
  origin := public.member_origin_cycle(member_row.id);
  period_end := (stamp_row.cycle_start + interval '12 months')::date;
  IF stamp_row.cycle_start < member_row.cycle_start THEN
    period_end := LEAST(period_end, member_row.cycle_start);
  END IF;

  problem := public.member_stamp_date_problem(
    origin,
    stamp_row.cycle_start,
    period_end,
    p_visit_date
  );
  IF problem IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', problem,
      'cycle_start', stamp_row.cycle_start,
      'reset_on', period_end,
      'origin', origin
    );
  END IF;

  IF stamp_row.visit_date = p_visit_date THEN
    RETURN jsonb_build_object('status', 'unchanged');
  END IF;

  SELECT stamp.service_name, stamp.created_at
  INTO existing_stamp
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = stamp_row.cycle_start
    AND stamp.visit_date = p_visit_date
    AND stamp.voided_at IS NULL
    AND stamp.id <> stamp_row.id
  ORDER BY stamp.created_at DESC
  LIMIT 1;

  IF existing_stamp.created_at IS NOT NULL AND NOT COALESCE(p_confirm_same_day, false) THEN
    RETURN jsonb_build_object(
      'status', 'needs_confirm',
      'service_name', existing_stamp.service_name,
      'created_at', existing_stamp.created_at
    );
  END IF;

  UPDATE public.member_stamps
  SET visit_date = p_visit_date
  WHERE id = stamp_row.id;

  PERFORM public.member_write_stamp_audit(
    member_row.id,
    stamp_row.id,
    'visit_date',
    stamp_row.visit_date::text,
    p_visit_date::text,
    stamp_row.service_name,
    p_visit_date,
    stamp_row.cycle_start,
    p_reason,
    '{}'::jsonb,
    p_changed_by,
    p_changed_by_email,
    p_changed_by_role
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', member_row.id,
    'visit_date', p_visit_date
  );
END;
$$;

CREATE FUNCTION public.member_add_past_stamp(
  p_member_id uuid,
  p_service_id uuid,
  p_visit_date date,
  p_confirm_same_day boolean,
  p_reason text,
  p_changed_by uuid,
  p_changed_by_email text,
  p_changed_by_role text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  origin date;
  period_start date;
  period_end date;
  past_period boolean;
  problem text;
  stamp_count integer;
  existing_stamp record;
  next_name text;
  inserted_id uuid;
  tier_before smallint;
  tier_after smallint;
  opened_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  member_row := public.member_roll_cycle(p_member_id);
  tier_before := public.member_current_tier(member_row.id);
  origin := public.member_origin_cycle(member_row.id);

  IF p_visit_date IS NOT NULL AND p_visit_date >= member_row.cycle_start THEN
    period_start := member_row.cycle_start;
    period_end := (member_row.cycle_start + interval '12 months')::date;
  ELSE
    period_start := COALESCE(public.member_period_start_for(origin, p_visit_date), origin);
    period_end := LEAST(
      (period_start + interval '12 months')::date,
      member_row.cycle_start
    );
  END IF;
  past_period := period_start < member_row.cycle_start;

  problem := public.member_stamp_date_problem(origin, period_start, period_end, p_visit_date);
  IF problem IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', problem,
      'cycle_start', period_start,
      'reset_on', period_end,
      'origin', origin
    );
  END IF;

  PERFORM 1
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = period_start
    AND stamp.voided_at IS NULL
  FOR UPDATE;

  SELECT count(*)::integer
  INTO stamp_count
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = period_start
    AND stamp.voided_at IS NULL;

  IF stamp_count >= 30 THEN
    RETURN jsonb_build_object(
      'status', 'capped',
      'count', stamp_count,
      'cycle_start', period_start,
      'reset_on', period_end
    );
  END IF;

  SELECT stamp.service_name, stamp.created_at
  INTO existing_stamp
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = period_start
    AND stamp.visit_date = p_visit_date
    AND stamp.voided_at IS NULL
  ORDER BY stamp.created_at DESC
  LIMIT 1;

  IF existing_stamp.created_at IS NOT NULL AND NOT COALESCE(p_confirm_same_day, false) THEN
    RETURN jsonb_build_object(
      'status', 'needs_confirm',
      'service_name', existing_stamp.service_name,
      'created_at', existing_stamp.created_at
    );
  END IF;

  SELECT services.name
  INTO next_name
  FROM public.services
  WHERE services.id = p_service_id
    AND services.is_active = true;

  IF next_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_service');
  END IF;

  INSERT INTO public.member_stamps (
    member_id,
    cycle_start,
    visit_date,
    service_id,
    service_name,
    created_by
  )
  VALUES (
    member_row.id,
    period_start,
    p_visit_date,
    p_service_id,
    next_name,
    p_changed_by
  )
  RETURNING id INTO inserted_id;

  IF past_period THEN
    PERFORM public.member_recompute_carry(member_row.id);
  ELSE
    -- Only the current period can claim, so only it can open a reward.
    SELECT rewards.name
    INTO opened_name
    FROM public.member_rewards AS rewards
    WHERE rewards.milestone = stamp_count + 1
      AND rewards.name IS NOT NULL;
  END IF;
  tier_after := public.member_current_tier(member_row.id);

  PERFORM public.member_write_stamp_audit(
    member_row.id,
    inserted_id,
    'add_past',
    NULL,
    p_visit_date::text,
    next_name,
    p_visit_date,
    period_start,
    p_reason,
    jsonb_build_object(
      'count_after', stamp_count + 1,
      'tier_before', tier_before,
      'tier_after', tier_after
    ),
    p_changed_by,
    p_changed_by_email,
    p_changed_by_role
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', member_row.id,
    'stamp_id', inserted_id,
    'count', stamp_count + 1,
    'cycle_start', period_start,
    'past_period', past_period,
    'service_name', next_name,
    'tier_before', tier_before,
    'tier_after', tier_after,
    'opened_reward', opened_name,
    'reset_on', period_end
  );
END;
$$;

-- Read model for the member card: every period from the origin to the
-- current one, with its stamps (voided ones included) and claims, plus the
-- latest correction rows. The current period comes from member_preview_cycle
-- so it matches get_member_summary without a write.
CREATE FUNCTION public.list_member_stamp_history(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  preview record;
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  origin date;
  v_start date;
  v_end date;
  v_steps integer := 0;
  periods jsonb := '[]'::jsonb;
BEGIN
  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT *
  INTO preview
  FROM public.member_preview_cycle(
    member_row.id,
    member_row.cycle_start,
    member_row.base_tier,
    today
  );

  origin := LEAST(public.member_origin_cycle(member_row.id), preview.cycle_start);
  v_start := origin;
  LOOP
    v_end := (v_start + interval '12 months')::date;
    IF v_start < preview.cycle_start THEN
      v_end := LEAST(v_end, preview.cycle_start);
    END IF;

    periods := periods || jsonb_build_array(jsonb_build_object(
      'cycle_start', v_start,
      'reset_on', v_end,
      'current', v_start = preview.cycle_start,
      'stamp_count', (
        SELECT count(*)::integer
        FROM public.member_stamps AS stamp
        WHERE stamp.member_id = member_row.id
          AND stamp.cycle_start = v_start
          AND stamp.voided_at IS NULL
      ),
      'claims', (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('milestone', claim.milestone, 'reward_name', claim.reward_name)
            ORDER BY claim.milestone
          ),
          '[]'::jsonb
        )
        FROM public.member_reward_claims AS claim
        WHERE claim.member_id = member_row.id
          AND claim.cycle_start = v_start
      )
    ));

    EXIT WHEN v_start >= preview.cycle_start;
    v_start := (v_start + interval '12 months')::date;
    v_steps := v_steps + 1;
    IF v_steps > 200 THEN
      RAISE EXCEPTION 'member_cycle_roll_limit';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'origin', origin,
    'cycle_start', preview.cycle_start,
    'reset_on', (preview.cycle_start + interval '12 months')::date,
    'today', today,
    'periods', periods,
    'stamps', (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(stamp_row) ORDER BY stamp_row.visit_date DESC, stamp_row.created_at DESC),
        '[]'::jsonb
      )
      FROM (
        SELECT
          stamp.id,
          stamp.cycle_start,
          stamp.visit_date,
          stamp.service_id,
          stamp.service_name,
          stamp.created_at,
          creator.name AS created_by_name,
          stamp.voided_at,
          voider.name AS voided_by_name
        FROM public.member_stamps AS stamp
        LEFT JOIN public.admins AS creator
          ON creator.id = stamp.created_by
        LEFT JOIN public.admins AS voider
          ON voider.id = stamp.voided_by
        WHERE stamp.member_id = member_row.id
        ORDER BY stamp.visit_date DESC, stamp.created_at DESC
        LIMIT 300
      ) AS stamp_row
    ),
    'audit', (
      SELECT COALESCE(jsonb_agg(to_jsonb(audit_row) ORDER BY audit_row.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          audit.id,
          audit.stamp_id,
          audit.action,
          audit.old_value,
          audit.new_value,
          audit.service_name,
          audit.visit_date,
          audit.cycle_start,
          audit.reason,
          audit.details,
          audit.changed_by_email,
          audit.changed_by_role,
          changer.name AS changed_by_name,
          audit.created_at
        FROM public.member_stamp_audit AS audit
        LEFT JOIN public.admins AS changer
          ON changer.id = audit.changed_by
        WHERE audit.member_id = member_row.id
        ORDER BY audit.created_at DESC
        LIMIT 30
      ) AS audit_row
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_origin_cycle(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_origin_cycle(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_period_start_for(date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_period_start_for(date, date)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_stamp_date_problem(date, date, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_stamp_date_problem(date, date, date, date)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_current_tier(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_current_tier(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_recompute_carry(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_recompute_carry(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_write_stamp_audit(uuid, uuid, text, text, text, text, date, date, text, jsonb, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_write_stamp_audit(uuid, uuid, text, text, text, text, date, date, text, jsonb, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_correct_void_stamp(uuid, boolean, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_correct_void_stamp(uuid, boolean, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_correct_stamp_service(uuid, uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_correct_stamp_service(uuid, uuid, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_correct_stamp_date(uuid, date, boolean, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_correct_stamp_date(uuid, date, boolean, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.member_add_past_stamp(uuid, uuid, date, boolean, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_add_past_stamp(uuid, uuid, date, boolean, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.list_member_stamp_history(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_member_stamp_history(uuid)
  TO service_role;

-- ============================================================================
-- Membership hardening on top of applied 033, 034, and 035
-- Date: 2026-11-18
--
-- 033, 034, and 035 are already applied and frozen. Later membership SQL
-- belongs in this file only. Existing rows are left unchanged.
--
-- 1. member_void_stamp recomputes the carried tier when an undo crosses a
--    cycle reset. Same-cycle undos are unchanged.
-- 2. member_claim_reward takes the member lock, locks live stamps, and
--    recounts before insert so a concurrent void cannot leave a claim with
--    too few stamps. The cashier must also pass the expected reward name.
-- 3. A birthday follow-up still appears after a same-year redemption so the
--    cashier can send a greeting. member_birthday_discount_available() is
--    false after that redemption; buildFollowupMessage must not offer the
--    discount in that case.
-- 4. If the configured reward name no longer matches what the cashier saw,
--    member_claim_reward returns reward_changed instead of writing a claim.
-- 5. member_save_rewards updates only the supplied milestones and rejects
--    the write when updated_at does not match.
-- 6. member_followup_is_due checks one member, stage, and anchor without
--    scanning every member.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.member_void_stamp(p_stamp_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  stamp_member_id uuid;
  stamp_row public.member_stamps;
  member_row public.members;
  today date;
  origin_cycle date;
  preview record;
BEGIN
  SELECT member_stamps.member_id
  INTO stamp_member_id
  FROM public.member_stamps
  WHERE member_stamps.id = p_stamp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = stamp_member_id
  FOR UPDATE;

  SELECT *
  INTO stamp_row
  FROM public.member_stamps
  WHERE id = p_stamp_id
  FOR UPDATE;

  IF stamp_row.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_voided');
  END IF;

  IF stamp_row.created_at <= now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('status', 'too_late');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.member_reward_claims AS claim
    WHERE claim.member_id = stamp_row.member_id
      AND claim.cycle_start = stamp_row.cycle_start
      AND claim.milestone > (
        SELECT count(*)
        FROM public.member_stamps AS open_stamp
        WHERE open_stamp.member_id = stamp_row.member_id
          AND open_stamp.cycle_start = stamp_row.cycle_start
          AND open_stamp.voided_at IS NULL
          AND open_stamp.id <> stamp_row.id
      )
  ) THEN
    RETURN jsonb_build_object('status', 'reward_claimed');
  END IF;

  UPDATE public.member_stamps
  SET
    voided_at = now(),
    voided_by = p_admin_id
  WHERE id = stamp_row.id;

  -- Same-cycle undos leave the stored cycle and base tier alone.
  IF stamp_row.cycle_start < member_row.cycle_start THEN
    today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
    SELECT LEAST(
      (member_row.created_at AT TIME ZONE 'Asia/Jakarta')::date,
      COALESCE(min(stamp.cycle_start), member_row.cycle_start)
    )
    INTO origin_cycle
    FROM public.member_stamps AS stamp
    WHERE stamp.member_id = member_row.id;

    SELECT *
    INTO preview
    FROM public.member_preview_cycle(
      member_row.id,
      origin_cycle,
      0::smallint,
      today
    );

    UPDATE public.members
    SET
      cycle_start = preview.cycle_start,
      base_tier = preview.base_tier,
      updated_at = now()
    WHERE id = member_row.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', stamp_row.member_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_void_stamp(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_void_stamp(uuid, uuid) TO service_role;

CREATE FUNCTION public.member_claim_reward(
  p_member_id uuid,
  p_milestone smallint,
  p_service_name text,
  p_admin_id uuid,
  p_expected_name text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  today date;
  stamp_count integer;
  reward_name text;
  expected text;
  inserted_id uuid;
  clean_service text := NULLIF(btrim(COALESCE(p_service_name, '')), '');
BEGIN
  IF p_milestone NOT IN (5, 10, 15, 20, 25, 30) THEN
    RETURN jsonb_build_object('status', 'not_reached');
  END IF;

  member_row := public.member_roll_cycle(p_member_id);
  today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  PERFORM 1
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = member_row.cycle_start
    AND stamp.voided_at IS NULL
  FOR UPDATE;

  SELECT count(*)::integer
  INTO stamp_count
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = member_row.cycle_start
    AND stamp.voided_at IS NULL;

  IF stamp_count < p_milestone THEN
    RETURN jsonb_build_object('status', 'not_reached');
  END IF;

  SELECT rewards.name
  INTO reward_name
  FROM public.member_rewards AS rewards
  WHERE rewards.milestone = p_milestone;

  IF reward_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_configured');
  END IF;

  expected := NULLIF(btrim(COALESCE(p_expected_name, '')), '');
  IF expected IS NULL OR expected IS DISTINCT FROM reward_name THEN
    RETURN jsonb_build_object(
      'status', 'reward_changed',
      'reward_name', reward_name
    );
  END IF;

  BEGIN
    INSERT INTO public.member_reward_claims (
      member_id,
      cycle_start,
      milestone,
      reward_name,
      service_name,
      claimed_by
    )
    VALUES (
      member_row.id,
      member_row.cycle_start,
      p_milestone,
      reward_name,
      clean_service,
      p_admin_id
    )
    RETURNING id INTO inserted_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'already_claimed');
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'claim_id', inserted_id,
    'reward_name', reward_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_claim_reward(uuid, smallint, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_reward(uuid, smallint, text, uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.member_claim_reward(uuid, smallint, text, uuid);

DROP FUNCTION IF EXISTS public.member_save_rewards(uuid, jsonb);

CREATE FUNCTION public.member_save_rewards(p_admin_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reward_row record;
  current_row public.member_rewards;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  FOR reward_row IN
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS row_data(
      milestone smallint,
      name text,
      note text,
      updated_at timestamptz
    )
    ORDER BY milestone
  LOOP
    IF reward_row.milestone IS NULL OR reward_row.milestone NOT IN (5, 10, 15, 20, 25, 30) THEN
      RETURN jsonb_build_object('status', 'invalid');
    END IF;

    SELECT *
    INTO current_row
    FROM public.member_rewards
    WHERE member_rewards.milestone = reward_row.milestone
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'invalid');
    END IF;

    IF current_row.updated_at IS DISTINCT FROM reward_row.updated_at THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'milestone', reward_row.milestone,
        'updated_at', current_row.updated_at
      );
    END IF;

    UPDATE public.member_rewards
    SET
      name = NULLIF(btrim(COALESCE(reward_row.name, '')), ''),
      note = NULLIF(btrim(COALESCE(reward_row.note, '')), ''),
      updated_by = p_admin_id,
      updated_at = now()
    WHERE member_rewards.milestone = reward_row.milestone;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.member_save_rewards(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_save_rewards(uuid, jsonb) TO service_role;

CREATE FUNCTION public.member_birthday_discount_available(p_member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  birthday record;
BEGIN
  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT *
  INTO birthday
  FROM public.member_nearest_birthday(member_row.birth_date, today);

  RETURN birthday.in_window AND NOT EXISTS (
    SELECT 1
    FROM public.member_birthday_redemptions AS redemption
    WHERE redemption.member_id = member_row.id
      AND redemption.birthday_year = birthday.birthday_year
  );
END;
$$;

REVOKE ALL ON FUNCTION public.member_birthday_discount_available(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_birthday_discount_available(uuid) TO service_role;

CREATE FUNCTION public.member_followup_is_due(
  p_member_id uuid,
  p_stage text,
  p_anchor_date date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  last_row record;
  day_stage text;
  birthday record;
BEGIN
  IF p_member_id IS NULL OR p_stage IS NULL OR p_anchor_date IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.member_followups AS sent
    WHERE sent.member_id = p_member_id
      AND sent.stage = p_stage
      AND sent.anchor_date = p_anchor_date
  ) THEN
    RETURN false;
  END IF;

  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = p_member_id
    AND wa_consent = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_stage = 'birthday' THEN
    SELECT *
    INTO birthday
    FROM public.member_nearest_birthday(member_row.birth_date, today);

    -- Keep a redeemed birthday in the due set so the cashier can still send
    -- a greeting. The WhatsApp copy must not offer the discount again.
    RETURN birthday.occurrence = today AND birthday.occurrence = p_anchor_date;
  END IF;

  IF p_stage NOT IN ('day30', 'day60', 'day90', 'day120') THEN
    RETURN false;
  END IF;

  SELECT *
  INTO last_row
  FROM public.member_last_treatment(member_row.id);

  IF NOT FOUND OR last_row.treatment_date IS NULL THEN
    RETURN false;
  END IF;

  IF last_row.treatment_date <> p_anchor_date THEN
    RETURN false;
  END IF;

  day_stage := public.member_followup_stage(today - last_row.treatment_date);
  RETURN day_stage = p_stage;
END;
$$;

REVOKE ALL ON FUNCTION public.member_followup_is_due(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_followup_is_due(uuid, text, date) TO service_role;

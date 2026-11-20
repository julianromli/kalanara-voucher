-- ============================================================================
-- Membership fixes on top of applied 033 and 034
-- Date: 2026-11-18
--
-- 033_membership.sql and 034_membership_cron.sql are already applied.
-- Later membership SQL belongs in this file only.
-- Existing rows are left unchanged.
-- ============================================================================

ALTER TABLE public.member_stamps
  DROP CONSTRAINT member_stamps_service_name_length;

ALTER TABLE public.member_stamps
  ADD CONSTRAINT member_stamps_service_name_length
  CHECK (char_length(btrim(service_name)) >= 1);

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

  IF stamp_row.cycle_start < member_row.cycle_start THEN
    today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
    origin_cycle := (member_row.created_at AT TIME ZONE 'Asia/Jakarta')::date;
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

CREATE OR REPLACE FUNCTION public.list_recent_members(p_limit integer)
RETURNS TABLE (
  id uuid,
  name text,
  source text,
  created_at timestamptz,
  stamp_count integer,
  last_stamp_at timestamptz,
  last_stamp_service text,
  last_claim_at timestamptz,
  last_claim_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    member_row.id,
    member_row.name,
    member_row.source,
    member_row.created_at,
    COALESCE((
      SELECT preview.stamp_count
      FROM public.member_preview_cycle(
        member_row.id,
        member_row.cycle_start,
        member_row.base_tier,
        (now() AT TIME ZONE 'Asia/Jakarta')::date
      ) AS preview
    ), 0)::integer AS stamp_count,
    last_stamp.created_at AS last_stamp_at,
    last_stamp.service_name AS last_stamp_service,
    last_claim.claimed_at AS last_claim_at,
    last_claim.reward_name AS last_claim_name
  FROM public.members AS member_row
  LEFT JOIN LATERAL (
    SELECT stamp.created_at, stamp.service_name
    FROM public.member_stamps AS stamp
    WHERE stamp.member_id = member_row.id
      AND stamp.voided_at IS NULL
    ORDER BY stamp.created_at DESC
    LIMIT 1
  ) AS last_stamp ON true
  LEFT JOIN LATERAL (
    SELECT claim.claimed_at, claim.reward_name
    FROM public.member_reward_claims AS claim
    WHERE claim.member_id = member_row.id
    ORDER BY claim.claimed_at DESC
    LIMIT 1
  ) AS last_claim ON true
  ORDER BY GREATEST(
    member_row.created_at,
    COALESCE(last_stamp.created_at, member_row.created_at),
    COALESCE(last_claim.claimed_at, member_row.created_at)
  ) DESC,
  member_row.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 30);
$$;

REVOKE ALL ON FUNCTION public.list_recent_members(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_recent_members(integer) TO service_role;

CREATE FUNCTION public.member_save_rewards(p_admin_id uuid, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reward_row record;
BEGIN
  FOR reward_row IN
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS row_data(
      milestone smallint,
      name text,
      note text
    )
  LOOP
    UPDATE public.member_rewards
    SET
      name = NULLIF(btrim(reward_row.name), ''),
      note = NULLIF(btrim(reward_row.note), ''),
      updated_by = p_admin_id,
      updated_at = now()
    WHERE member_rewards.milestone = reward_row.milestone;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.member_save_rewards(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_save_rewards(uuid, jsonb) TO service_role;

CREATE FUNCTION public.member_self_signup(
  p_qr_token text,
  p_name text,
  p_phone text,
  p_birth_date date,
  p_wa_consent boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  qr_id uuid;
  card text;
BEGIN
  SELECT signup.id
  INTO qr_id
  FROM public.member_signup_qr AS signup
  WHERE signup.token = lower(p_qr_token)
    AND signup.revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_qr');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.members
    WHERE members.phone = p_phone
  ) THEN
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;

  BEGIN
    INSERT INTO public.members (
      name,
      phone,
      birth_date,
      wa_consent,
      wa_consent_at,
      source,
      signup_qr_id,
      created_by
    )
    VALUES (
      p_name,
      p_phone,
      p_birth_date,
      p_wa_consent,
      CASE WHEN p_wa_consent THEN now() ELSE NULL END,
      'self_signup',
      qr_id,
      NULL
    )
    RETURNING members.card_token INTO card;
  EXCEPTION
    WHEN unique_violation THEN
      IF EXISTS (
        SELECT 1
        FROM public.members
        WHERE members.phone = p_phone
      ) THEN
        RETURN jsonb_build_object('status', 'duplicate');
      END IF;
      RETURN jsonb_build_object('status', 'retry');
  END;

  RETURN jsonb_build_object('status', 'ok', 'card_token', card);
END;
$$;

REVOKE ALL ON FUNCTION public.member_self_signup(text, text, text, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_self_signup(text, text, text, date, boolean) TO service_role;

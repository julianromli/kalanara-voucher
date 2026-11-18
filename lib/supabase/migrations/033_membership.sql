-- ============================================================================
-- Membership stamps, rewards, follow-up and self sign-up
-- Date: 2026-11-18
--
-- Apply notes:
--   1. Apply this file before the membership server actions.
--   2. Do not add anon or authenticated policies. Server code uses the
--      service-role client.
--   3. Calculation on read is the source of truth. member_roll_cycle persists
--      a reset only on a write. get_member_summary previews the same roll.
-- ============================================================================

CREATE TABLE public.member_signup_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);

CREATE UNIQUE INDEX member_signup_qr_one_active_idx
  ON public.member_signup_qr ((true))
  WHERE revoked_at IS NULL;

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  birth_date date NOT NULL,
  wa_consent boolean NOT NULL DEFAULT false,
  wa_consent_at timestamptz,
  card_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  card_token_rotated_at timestamptz,
  member_code text NOT NULL UNIQUE,
  source text NOT NULL,
  cycle_start date NOT NULL,
  base_tier smallint NOT NULL DEFAULT 0,
  signup_qr_id uuid REFERENCES public.member_signup_qr (id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_name_length CHECK (char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT members_phone_normalized CHECK (phone ~ '^62[0-9]{8,13}$'),
  CONSTRAINT members_source_known CHECK (source IN ('cashier', 'self_signup')),
  CONSTRAINT members_base_tier_known CHECK (base_tier BETWEEN 0 AND 3),
  CONSTRAINT members_consent_time CHECK (
    (wa_consent = false AND wa_consent_at IS NULL)
    OR (wa_consent = true AND wa_consent_at IS NOT NULL)
  )
);

CREATE INDEX members_created_at_idx
  ON public.members (created_at DESC);

CREATE INDEX members_source_created_at_idx
  ON public.members (source, created_at DESC);

CREATE TABLE public.member_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  visit_date date NOT NULL,
  service_id uuid REFERENCES public.services (id) ON DELETE SET NULL,
  service_name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid,
  CONSTRAINT member_stamps_service_name_length CHECK (
    char_length(btrim(service_name)) >= 1
  )
);

CREATE INDEX member_stamps_open_cycle_idx
  ON public.member_stamps (member_id, cycle_start)
  WHERE voided_at IS NULL;

CREATE INDEX member_stamps_member_created_idx
  ON public.member_stamps (member_id, created_at DESC);

CREATE TABLE public.member_rewards (
  milestone smallint PRIMARY KEY,
  name text,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_rewards_milestone_known CHECK (
    milestone IN (5, 10, 15, 20, 25, 30)
  ),
  CONSTRAINT member_rewards_name_length CHECK (
    name IS NULL OR char_length(name) BETWEEN 1 AND 40
  ),
  CONSTRAINT member_rewards_note_length CHECK (
    note IS NULL OR char_length(note) <= 80
  )
);

CREATE TABLE public.member_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  milestone smallint NOT NULL,
  reward_name text NOT NULL,
  service_name text,
  claimed_by uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_reward_claims_milestone_known CHECK (
    milestone IN (5, 10, 15, 20, 25, 30)
  ),
  CONSTRAINT member_reward_claims_unique_cycle UNIQUE (member_id, cycle_start, milestone)
);

CREATE TABLE public.member_birthday_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  birthday_year smallint NOT NULL,
  service_name text,
  redeemed_by uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_birthday_redemptions_unique_year UNIQUE (member_id, birthday_year)
);

CREATE TABLE public.member_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  stage text NOT NULL,
  anchor_date date NOT NULL,
  marked_by uuid,
  marked_at timestamptz,
  CONSTRAINT member_followups_stage_known CHECK (
    stage IN ('day30', 'day60', 'day90', 'day120', 'birthday')
  ),
  CONSTRAINT member_followups_unique_anchor UNIQUE (member_id, stage, anchor_date)
);

CREATE INDEX member_followups_marked_at_idx
  ON public.member_followups (marked_at DESC);

ALTER TABLE public.member_signup_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_birthday_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_followups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_signup_qr FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_stamps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_rewards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_reward_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_birthday_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.member_followups FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.member_signup_qr TO service_role;
GRANT ALL ON TABLE public.members TO service_role;
GRANT ALL ON TABLE public.member_stamps TO service_role;
GRANT ALL ON TABLE public.member_rewards TO service_role;
GRANT ALL ON TABLE public.member_reward_claims TO service_role;
GRANT ALL ON TABLE public.member_birthday_redemptions TO service_role;
GRANT ALL ON TABLE public.member_followups TO service_role;

CREATE FUNCTION public.member_tier_from_stamps(p_count integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_count >= 30 THEN 3
    WHEN p_count >= 20 THEN 2
    WHEN p_count >= 10 THEN 1
    ELSE 0
  END::smallint;
$$;

CREATE FUNCTION public.member_followup_stage(p_days integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_days IS NULL OR p_days < 30 THEN NULL
    WHEN p_days < 60 THEN 'day30'
    WHEN p_days < 90 THEN 'day60'
    WHEN p_days < 120 THEN 'day90'
    ELSE 'day120'
  END;
$$;

CREATE FUNCTION public.member_is_leap_year(p_year integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT (p_year % 4 = 0 AND p_year % 100 <> 0) OR (p_year % 400 = 0);
$$;

CREATE FUNCTION public.member_birthday_occurrence(p_birth_date date, p_year integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  month_n integer := EXTRACT(MONTH FROM p_birth_date)::integer;
  day_n integer := EXTRACT(DAY FROM p_birth_date)::integer;
BEGIN
  IF month_n = 2 AND day_n = 29 AND NOT public.member_is_leap_year(p_year) THEN
    RETURN make_date(p_year, 2, 28);
  END IF;

  RETURN make_date(p_year, month_n, day_n);
END;
$$;

CREATE FUNCTION public.member_nearest_birthday(p_birth_date date, p_today date)
RETURNS TABLE (
  occurrence date,
  birthday_year smallint,
  window_start date,
  window_end date,
  in_window boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  base_year integer := EXTRACT(YEAR FROM p_today)::integer;
  year_n integer;
  candidate date;
  best date;
  best_distance integer;
  distance integer;
BEGIN
  FOREACH year_n IN ARRAY ARRAY[base_year - 1, base_year, base_year + 1]
  LOOP
    candidate := public.member_birthday_occurrence(p_birth_date, year_n);
    distance := abs(candidate - p_today);

    IF best IS NULL
      OR distance < best_distance
      OR (
        distance = best_distance
        AND candidate >= p_today
        AND best < p_today
      )
    THEN
      best := candidate;
      best_distance := distance;
    END IF;
  END LOOP;

  occurrence := best;
  birthday_year := EXTRACT(YEAR FROM best)::smallint;
  window_start := best - 7;
  window_end := best + 7;
  in_window := p_today BETWEEN window_start AND window_end;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.member_random_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea := extensions.gen_random_bytes(6);
  result text := '';
  index_n integer;
BEGIN
  FOR index_n IN 0..5 LOOP
    result := result || substr(alphabet, (get_byte(raw, index_n) % 32) + 1, 1);
  END LOOP;

  RETURN result;
END;
$$;

CREATE FUNCTION public.members_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  attempt integer := 0;
  candidate text;
BEGIN
  IF NEW.card_token IS NULL OR btrim(NEW.card_token) = '' THEN
    NEW.card_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;

  IF NEW.member_code IS NULL OR btrim(NEW.member_code) = '' THEN
    LOOP
      attempt := attempt + 1;
      candidate := public.member_random_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.members
        WHERE member_code = candidate
      );
      IF attempt > 8 THEN
        RAISE EXCEPTION 'member_code_generation_failed';
      END IF;
    END LOOP;
    NEW.member_code := candidate;
  END IF;

  IF NEW.cycle_start IS NULL THEN
    NEW.cycle_start := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  IF NEW.wa_consent IS TRUE AND NEW.wa_consent_at IS NULL THEN
    NEW.wa_consent_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER members_before_insert_trg
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_before_insert();

CREATE FUNCTION public.members_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER members_set_updated_at_trg
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_set_updated_at();

CREATE FUNCTION public.member_preview_cycle(
  p_member_id uuid,
  p_cycle_start date,
  p_base_tier smallint,
  p_today date
)
RETURNS TABLE (
  cycle_start date,
  base_tier smallint,
  stamp_count integer,
  rolled_cycles integer,
  tier_before smallint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cycle date := p_cycle_start;
  v_tier smallint := p_base_tier;
  v_count integer := 0;
  v_effective smallint;
  v_rolls integer := 0;
  v_before smallint := NULL;
BEGIN
  LOOP
    SELECT count(*)::integer
    INTO v_count
    FROM public.member_stamps AS stamp
    WHERE stamp.member_id = p_member_id
      AND stamp.cycle_start = v_cycle
      AND stamp.voided_at IS NULL;

    EXIT WHEN p_today < (v_cycle + interval '12 months')::date;

    v_effective := GREATEST(public.member_tier_from_stamps(v_count), v_tier);
    IF v_rolls = 0 THEN
      v_before := v_effective;
    END IF;

    v_tier := GREATEST(v_effective - 1, 0)::smallint;
    v_cycle := (v_cycle + interval '12 months')::date;
    v_rolls := v_rolls + 1;

    IF v_rolls > 200 THEN
      RAISE EXCEPTION 'member_cycle_roll_limit';
    END IF;
  END LOOP;

  cycle_start := v_cycle;
  base_tier := v_tier;
  stamp_count := v_count;
  rolled_cycles := v_rolls;
  tier_before := v_before;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.member_roll_cycle(p_member_id uuid)
RETURNS public.members
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  preview record;
BEGIN
  SELECT *
  INTO member_row
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  SELECT *
  INTO preview
  FROM public.member_preview_cycle(
    member_row.id,
    member_row.cycle_start,
    member_row.base_tier,
    today
  );

  UPDATE public.members
  SET
    cycle_start = preview.cycle_start,
    base_tier = preview.base_tier,
    updated_at = now()
  WHERE id = member_row.id
  RETURNING * INTO member_row;

  RETURN member_row;
END;
$$;

CREATE FUNCTION public.member_add_stamp(
  p_member_id uuid,
  p_service_id uuid,
  p_admin_id uuid,
  p_confirm_same_day boolean
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
  preview record;
  existing_stamp record;
  service_name text;
  inserted_id uuid;
  tier_before smallint;
  tier_after smallint;
  opened_name text;
BEGIN
  member_row := public.member_roll_cycle(p_member_id);
  today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT *
  INTO preview
  FROM public.member_preview_cycle(
    member_row.id,
    member_row.cycle_start,
    member_row.base_tier,
    today
  );

  IF preview.stamp_count >= 30 THEN
    RETURN jsonb_build_object(
      'status', 'capped',
      'count', preview.stamp_count,
      'reset_on', (member_row.cycle_start + interval '12 months')::date
    );
  END IF;

  SELECT stamp.service_name, stamp.created_at
  INTO existing_stamp
  FROM public.member_stamps AS stamp
  WHERE stamp.member_id = member_row.id
    AND stamp.cycle_start = member_row.cycle_start
    AND stamp.visit_date = today
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
  INTO service_name
  FROM public.services
  WHERE services.id = p_service_id
    AND services.is_active = true;

  IF service_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_service');
  END IF;

  tier_before := GREATEST(
    public.member_tier_from_stamps(preview.stamp_count),
    member_row.base_tier
  );

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
    member_row.cycle_start,
    today,
    p_service_id,
    service_name,
    p_admin_id
  )
  RETURNING id INTO inserted_id;

  tier_after := GREATEST(
    public.member_tier_from_stamps(preview.stamp_count + 1),
    member_row.base_tier
  );

  SELECT rewards.name
  INTO opened_name
  FROM public.member_rewards AS rewards
  WHERE rewards.milestone = preview.stamp_count + 1
    AND rewards.name IS NOT NULL;

  RETURN jsonb_build_object(
    'status', 'ok',
    'stamp_id', inserted_id,
    'count', preview.stamp_count + 1,
    'service_name', service_name,
    'tier_before', tier_before,
    'tier_after', tier_after,
    'opened_reward', opened_name,
    'reset_on', (member_row.cycle_start + interval '12 months')::date
  );
END;
$$;

CREATE FUNCTION public.member_void_stamp(p_stamp_id uuid, p_admin_id uuid)
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
      0,
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

CREATE FUNCTION public.member_claim_reward(
  p_member_id uuid,
  p_milestone smallint,
  p_service_name text,
  p_admin_id uuid
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
  preview record;
  reward_name text;
  inserted_id uuid;
  clean_service text := NULLIF(btrim(COALESCE(p_service_name, '')), '');
BEGIN
  IF p_milestone NOT IN (5, 10, 15, 20, 25, 30) THEN
    RETURN jsonb_build_object('status', 'not_reached');
  END IF;

  member_row := public.member_roll_cycle(p_member_id);
  today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT *
  INTO preview
  FROM public.member_preview_cycle(
    member_row.id,
    member_row.cycle_start,
    member_row.base_tier,
    today
  );

  IF preview.stamp_count < p_milestone THEN
    RETURN jsonb_build_object('status', 'not_reached');
  END IF;

  SELECT rewards.name
  INTO reward_name
  FROM public.member_rewards AS rewards
  WHERE rewards.milestone = p_milestone;

  IF reward_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_configured');
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

CREATE FUNCTION public.member_void_claim(p_claim_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  claim_row public.member_reward_claims;
BEGIN
  SELECT *
  INTO claim_row
  FROM public.member_reward_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF claim_row.claimed_at <= now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('status', 'too_late');
  END IF;

  DELETE FROM public.member_reward_claims
  WHERE id = claim_row.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'member_id', claim_row.member_id,
    'voided_by', p_admin_id
  );
END;
$$;

CREATE FUNCTION public.member_redeem_birthday(
  p_member_id uuid,
  p_service_name text,
  p_admin_id uuid
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
  birthday record;
  inserted_id uuid;
  clean_service text := NULLIF(btrim(COALESCE(p_service_name, '')), '');
BEGIN
  member_row := public.member_roll_cycle(p_member_id);
  today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  SELECT *
  INTO birthday
  FROM public.member_nearest_birthday(member_row.birth_date, today);

  IF NOT birthday.in_window THEN
    RETURN jsonb_build_object('status', 'not_in_window');
  END IF;

  BEGIN
    INSERT INTO public.member_birthday_redemptions (
      member_id,
      birthday_year,
      service_name,
      redeemed_by
    )
    VALUES (
      member_row.id,
      birthday.birthday_year,
      clean_service,
      p_admin_id
    )
    RETURNING id INTO inserted_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'already_redeemed');
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'redemption_id', inserted_id,
    'birthday_year', birthday.birthday_year,
    'window_start', birthday.window_start,
    'window_end', birthday.window_end
  );
END;
$$;

CREATE FUNCTION public.member_last_treatment(p_member_id uuid)
RETURNS TABLE (
  treatment_date date,
  service_name text,
  kind text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH events AS (
    SELECT
      stamp.visit_date AS treatment_date,
      stamp.service_name,
      'stamp'::text AS kind,
      stamp.created_at AS event_at
    FROM public.member_stamps AS stamp
    WHERE stamp.member_id = p_member_id
      AND stamp.voided_at IS NULL
    UNION ALL
    SELECT
      (claim.claimed_at AT TIME ZONE 'Asia/Jakarta')::date,
      COALESCE(claim.service_name, claim.reward_name),
      'claim'::text,
      claim.claimed_at
    FROM public.member_reward_claims AS claim
    WHERE claim.member_id = p_member_id
    UNION ALL
    SELECT
      (redemption.redeemed_at AT TIME ZONE 'Asia/Jakarta')::date,
      COALESCE(redemption.service_name, 'Diskon ulang tahun'),
      'birthday'::text,
      redemption.redeemed_at
    FROM public.member_birthday_redemptions AS redemption
    WHERE redemption.member_id = p_member_id
  )
  SELECT events.treatment_date, events.service_name, events.kind
  FROM events
  ORDER BY events.treatment_date DESC, events.event_at DESC
  LIMIT 1;
$$;

CREATE FUNCTION public.list_member_followups()
RETURNS TABLE (
  member_id uuid,
  name text,
  phone text,
  stage text,
  anchor_date date,
  last_service_name text,
  stamp_count integer,
  effective_tier smallint,
  days_since integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  member_row record;
  preview record;
  last_row record;
  last_service text;
  day_stage text;
  day_count integer;
  birthday record;
BEGIN
  FOR member_row IN
    SELECT members.*
    FROM public.members
    WHERE members.wa_consent = true
  LOOP
    SELECT *
    INTO preview
    FROM public.member_preview_cycle(
      member_row.id,
      member_row.cycle_start,
      member_row.base_tier,
      today
    );

    last_service := '';

    SELECT *
    INTO last_row
    FROM public.member_last_treatment(member_row.id);

    IF FOUND AND last_row.treatment_date IS NOT NULL THEN
      last_service := COALESCE(last_row.service_name, '');
      day_count := today - last_row.treatment_date;
      day_stage := public.member_followup_stage(day_count);

      IF day_stage IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.member_followups AS sent
        WHERE sent.member_id = member_row.id
          AND sent.stage = day_stage
          AND sent.anchor_date = last_row.treatment_date
      ) THEN
        member_id := member_row.id;
        name := member_row.name;
        phone := member_row.phone;
        stage := day_stage;
        anchor_date := last_row.treatment_date;
        last_service_name := last_row.service_name;
        stamp_count := preview.stamp_count;
        effective_tier := GREATEST(
          public.member_tier_from_stamps(preview.stamp_count),
          preview.base_tier
        );
        days_since := day_count;
        RETURN NEXT;
      END IF;
    END IF;

    SELECT *
    INTO birthday
    FROM public.member_nearest_birthday(member_row.birth_date, today);

    IF birthday.occurrence = today AND NOT EXISTS (
      SELECT 1
      FROM public.member_followups AS sent
      WHERE sent.member_id = member_row.id
        AND sent.stage = 'birthday'
        AND sent.anchor_date = birthday.occurrence
    ) THEN
      member_id := member_row.id;
      name := member_row.name;
      phone := member_row.phone;
      stage := 'birthday';
      anchor_date := birthday.occurrence;
      last_service_name := last_service;
      stamp_count := preview.stamp_count;
      effective_tier := GREATEST(
        public.member_tier_from_stamps(preview.stamp_count),
        preview.base_tier
      );
      days_since := 0;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.get_member_summary(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_row public.members;
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  preview record;
  birthday record;
  last_row record;
  has_treatment boolean := false;
  effective smallint;
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

  SELECT *
  INTO birthday
  FROM public.member_nearest_birthday(member_row.birth_date, today);

  SELECT *
  INTO last_row
  FROM public.member_last_treatment(member_row.id);
  has_treatment := FOUND;

  effective := GREATEST(
    public.member_tier_from_stamps(preview.stamp_count),
    preview.base_tier
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'member', jsonb_build_object(
      'id', member_row.id,
      'name', member_row.name,
      'phone', member_row.phone,
      'birth_date', member_row.birth_date,
      'wa_consent', member_row.wa_consent,
      'member_code', member_row.member_code,
      'source', member_row.source,
      'created_at', member_row.created_at,
      'card_token', member_row.card_token
    ),
    'stamp_count', preview.stamp_count,
    'base_tier', preview.base_tier,
    'effective_tier', effective,
    'cycle_start', preview.cycle_start,
    'rolled_cycles', preview.rolled_cycles,
    'tier_before', preview.tier_before,
    'reset_on', (preview.cycle_start + interval '12 months')::date,
    'birthday', jsonb_build_object(
      'eligible', birthday.in_window AND NOT EXISTS (
        SELECT 1
        FROM public.member_birthday_redemptions AS redemption
        WHERE redemption.member_id = member_row.id
          AND redemption.birthday_year = birthday.birthday_year
      ),
      'redeemed', EXISTS (
        SELECT 1
        FROM public.member_birthday_redemptions AS redemption
        WHERE redemption.member_id = member_row.id
          AND redemption.birthday_year = birthday.birthday_year
      ),
      'occurrence', birthday.occurrence,
      'window_start', birthday.window_start,
      'window_end', birthday.window_end,
      'birthday_year', birthday.birthday_year
    ),
    'last_treatment', CASE
      WHEN NOT has_treatment THEN NULL
      ELSE jsonb_build_object(
        'date', last_row.treatment_date,
        'service_name', last_row.service_name,
        'kind', last_row.kind
      )
    END,
    'rewards', (
      SELECT COALESCE(jsonb_agg(to_jsonb(reward_row) ORDER BY reward_row.milestone), '[]'::jsonb)
      FROM (
        SELECT
          rewards.milestone,
          rewards.name,
          rewards.note,
          claim.id AS claim_id,
          claim.reward_name AS claimed_name,
          claim.service_name AS claimed_service,
          claim.claimed_at,
          admin_row.name AS claimed_by_name
        FROM public.member_rewards AS rewards
        LEFT JOIN public.member_reward_claims AS claim
          ON claim.member_id = member_row.id
          AND claim.cycle_start = preview.cycle_start
          AND claim.milestone = rewards.milestone
        LEFT JOIN public.admins AS admin_row
          ON admin_row.id = claim.claimed_by
      ) AS reward_row
    ),
    'stamps', (
      SELECT COALESCE(jsonb_agg(to_jsonb(stamp_row) ORDER BY stamp_row.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          stamp.id,
          stamp.visit_date,
          stamp.service_name,
          stamp.created_at,
          admin_row.name AS created_by_name
        FROM public.member_stamps AS stamp
        LEFT JOIN public.admins AS admin_row
          ON admin_row.id = stamp.created_by
        WHERE stamp.member_id = member_row.id
          AND stamp.voided_at IS NULL
        ORDER BY stamp.created_at DESC
        LIMIT 30
      ) AS stamp_row
    ),
    'claims', (
      SELECT COALESCE(jsonb_agg(to_jsonb(claim_row) ORDER BY claim_row.claimed_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          claim.id,
          claim.milestone,
          claim.reward_name,
          claim.service_name,
          claim.claimed_at,
          claim.cycle_start,
          admin_row.name AS claimed_by_name
        FROM public.member_reward_claims AS claim
        LEFT JOIN public.admins AS admin_row
          ON admin_row.id = claim.claimed_by
        WHERE claim.member_id = member_row.id
        ORDER BY claim.claimed_at DESC
        LIMIT 30
      ) AS claim_row
    ),
    'birthday_redemptions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(redemption_row) ORDER BY redemption_row.redeemed_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          redemption.id,
          redemption.birthday_year,
          redemption.service_name,
          redemption.redeemed_at,
          admin_row.name AS redeemed_by_name
        FROM public.member_birthday_redemptions AS redemption
        LEFT JOIN public.admins AS admin_row
          ON admin_row.id = redemption.redeemed_by
        WHERE redemption.member_id = member_row.id
        ORDER BY redemption.redeemed_at DESC
        LIMIT 10
      ) AS redemption_row
    )
  );
END;
$$;

CREATE FUNCTION public.list_recent_members(p_limit integer)
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

CREATE FUNCTION public.member_reward_reached_counts()
RETURNS TABLE (
  milestone smallint,
  reached_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH previewed AS (
    SELECT (public.member_preview_cycle(
      member_row.id,
      member_row.cycle_start,
      member_row.base_tier,
      (now() AT TIME ZONE 'Asia/Jakarta')::date
    )).stamp_count AS stamp_count
    FROM public.members AS member_row
  ),
  milestones AS (
    SELECT unnest(ARRAY[5, 10, 15, 20, 25, 30]::smallint[]) AS milestone
  )
  SELECT
    milestones.milestone,
    count(previewed.stamp_count)::integer AS reached_count
  FROM milestones
  LEFT JOIN previewed
    ON previewed.stamp_count >= milestones.milestone
  GROUP BY milestones.milestone
  ORDER BY milestones.milestone;
$$;

CREATE FUNCTION public.member_regenerate_signup_qr(p_admin_id uuid)
RETURNS public.member_signup_qr
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  created_row public.member_signup_qr;
BEGIN
  UPDATE public.member_signup_qr
  SET
    revoked_at = now(),
    revoked_by = p_admin_id
  WHERE revoked_at IS NULL;

  INSERT INTO public.member_signup_qr (created_by)
  VALUES (p_admin_id)
  RETURNING * INTO created_row;

  RETURN created_row;
END;
$$;

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
      RETURN jsonb_build_object('status', 'duplicate');
  END;

  RETURN jsonb_build_object('status', 'ok', 'card_token', card);
END;
$$;

CREATE FUNCTION public.member_rotate_card_token(p_member_id uuid, p_admin_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  new_token text;
BEGIN
  UPDATE public.members
  SET
    card_token = encode(extensions.gen_random_bytes(24), 'hex'),
    card_token_rotated_at = now(),
    updated_at = now()
  WHERE id = p_member_id
  RETURNING card_token INTO new_token;

  IF new_token IS NULL THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  RETURN new_token;
END;
$$;

INSERT INTO public.member_rewards (milestone, name)
VALUES
  (5, 'Totok gratis'),
  (10, 'Treatment gratis'),
  (15, NULL),
  (20, NULL),
  (25, NULL),
  (30, NULL);

INSERT INTO public.member_signup_qr (created_by)
VALUES (NULL);

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'membership.followup.day30',
    'Halo {nama}, apa kabar? Udah sebulan sejak {treatment} terakhir kamu di Kalanara. Yuk recharge badan kamu lagi, mau aku bantu reservasi ulang?',
    'Follow-up WhatsApp template for day 30'
  ),
  (
    'membership.followup.day60',
    'Hai {nama}, badan udah mulai pegal lagi belum? Stamp kamu sekarang {stamp}, tinggal {sisa} lagi buat {reward_berikutnya}. Kabarin aja kalau mau aku cariin jadwal ya.',
    'Follow-up WhatsApp template for day 60'
  ),
  (
    'membership.followup.day90',
    'Halo {nama}, kangen nih! Udah 3 bulan kamu belum mampir ke Kalanara. Mau aku siapin slot akhir pekan ini? Tinggal balas jam yang kamu mau.',
    'Follow-up WhatsApp template for day 90'
  ),
  (
    'membership.followup.day120',
    'Hai {nama}, ini pesan terakhir dari aku biar nggak ganggu ya. Kalau kapan-kapan butuh me-time, Kalanara selalu siap. Kartu member kamu: {link_kartu}',
    'Follow-up WhatsApp template for day 120'
  ),
  (
    'membership.followup.birthday',
    'Selamat ulang tahun, {nama}! Semoga sehat dan bahagia selalu. Ada hadiah kecil dari Kalanara: diskon 25% buat 1 treatment, berlaku sampai {tanggal_akhir}. Mau aku bantu reservasi?',
    'Follow-up WhatsApp template for a birthday'
  )
ON CONFLICT (key) DO NOTHING;

REVOKE ALL ON FUNCTION public.member_tier_from_stamps(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_tier_from_stamps(integer) TO service_role;

REVOKE ALL ON FUNCTION public.member_followup_stage(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_followup_stage(integer) TO service_role;

REVOKE ALL ON FUNCTION public.member_is_leap_year(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_is_leap_year(integer) TO service_role;

REVOKE ALL ON FUNCTION public.member_birthday_occurrence(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_birthday_occurrence(date, integer) TO service_role;

REVOKE ALL ON FUNCTION public.member_nearest_birthday(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_nearest_birthday(date, date) TO service_role;

REVOKE ALL ON FUNCTION public.member_random_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_random_code() TO service_role;

REVOKE ALL ON FUNCTION public.members_before_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.members_before_insert() TO service_role;

REVOKE ALL ON FUNCTION public.members_set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.members_set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.member_preview_cycle(uuid, date, smallint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_preview_cycle(uuid, date, smallint, date) TO service_role;

REVOKE ALL ON FUNCTION public.member_roll_cycle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_roll_cycle(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_add_stamp(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_add_stamp(uuid, uuid, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.member_void_stamp(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_void_stamp(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_claim_reward(uuid, smallint, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_claim_reward(uuid, smallint, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_void_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_void_claim(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_redeem_birthday(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_redeem_birthday(uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_last_treatment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_last_treatment(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_member_followups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_member_followups() TO service_role;

REVOKE ALL ON FUNCTION public.get_member_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_summary(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_recent_members(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_recent_members(integer) TO service_role;

REVOKE ALL ON FUNCTION public.member_reward_reached_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_reward_reached_counts() TO service_role;

REVOKE ALL ON FUNCTION public.member_regenerate_signup_qr(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_regenerate_signup_qr(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_rotate_card_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_rotate_card_token(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.member_save_rewards(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_save_rewards(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.member_self_signup(text, text, text, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_self_signup(text, text, text, date, boolean) TO service_role;

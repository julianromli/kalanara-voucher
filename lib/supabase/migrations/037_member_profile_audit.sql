-- ============================================================================
-- Durable audit log for member profile edits (name, phone, birth date, WA consent)
-- Date: 2026-11-25
--
-- Apply notes:
--   1. Apply this file before merging the updateMember server action.
--   2. Do not add anon or authenticated policies. Server code uses the
--      service-role client, same as membership tables in 033.
--   3. Do not apply from the app or CI. A person must run this on the
--      live project after review.
-- ============================================================================

CREATE TABLE public.member_profile_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  changed_by uuid,
  changed_by_email text,
  changed_by_role text,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_profile_audit_field_known CHECK (
    field IN ('name', 'phone', 'birth_date', 'wa_consent')
  )
);

CREATE INDEX member_profile_audit_member_created_idx
  ON public.member_profile_audit (member_id, created_at DESC);

ALTER TABLE public.member_profile_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.member_profile_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.member_profile_audit TO service_role;

CREATE OR REPLACE FUNCTION public.member_update_profile(
  p_member_id uuid,
  p_name text,
  p_phone text,
  p_birth_date date,
  p_wa_consent boolean,
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
  current public.members;
  next_consent_at timestamptz;
  changed text[] := '{}';
BEGIN
  SELECT *
  INTO current
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF current.name IS NOT DISTINCT FROM p_name
    AND current.phone IS NOT DISTINCT FROM p_phone
    AND current.birth_date IS NOT DISTINCT FROM p_birth_date
    AND current.wa_consent IS NOT DISTINCT FROM p_wa_consent
  THEN
    RETURN jsonb_build_object('status', 'unchanged');
  END IF;

  next_consent_at := current.wa_consent_at;
  IF p_wa_consent IS DISTINCT FROM current.wa_consent THEN
    next_consent_at := CASE WHEN p_wa_consent THEN now() ELSE NULL END;
  END IF;

  UPDATE public.members
  SET
    name = p_name,
    phone = p_phone,
    birth_date = p_birth_date,
    wa_consent = p_wa_consent,
    wa_consent_at = next_consent_at
  WHERE id = p_member_id;

  IF current.name IS DISTINCT FROM p_name THEN
    INSERT INTO public.member_profile_audit (
      member_id, changed_by, changed_by_email, changed_by_role, field, old_value, new_value
    ) VALUES (
      p_member_id, p_changed_by, p_changed_by_email, p_changed_by_role, 'name', current.name, p_name
    );
    changed := array_append(changed, 'name');
  END IF;

  IF current.phone IS DISTINCT FROM p_phone THEN
    INSERT INTO public.member_profile_audit (
      member_id, changed_by, changed_by_email, changed_by_role, field, old_value, new_value
    ) VALUES (
      p_member_id, p_changed_by, p_changed_by_email, p_changed_by_role, 'phone', current.phone, p_phone
    );
    changed := array_append(changed, 'phone');
  END IF;

  IF current.birth_date IS DISTINCT FROM p_birth_date THEN
    INSERT INTO public.member_profile_audit (
      member_id, changed_by, changed_by_email, changed_by_role, field, old_value, new_value
    ) VALUES (
      p_member_id, p_changed_by, p_changed_by_email, p_changed_by_role,
      'birth_date', current.birth_date::text, p_birth_date::text
    );
    changed := array_append(changed, 'birth_date');
  END IF;

  IF current.wa_consent IS DISTINCT FROM p_wa_consent THEN
    INSERT INTO public.member_profile_audit (
      member_id, changed_by, changed_by_email, changed_by_role, field, old_value, new_value
    ) VALUES (
      p_member_id, p_changed_by, p_changed_by_email, p_changed_by_role,
      'wa_consent',
      CASE WHEN current.wa_consent THEN 'true' ELSE 'false' END,
      CASE WHEN p_wa_consent THEN 'true' ELSE 'false' END
    );
    changed := array_append(changed, 'wa_consent');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'fields', to_jsonb(changed));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate');
END;
$$;

REVOKE ALL ON FUNCTION public.member_update_profile(uuid, text, text, date, boolean, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_update_profile(uuid, text, text, date, boolean, uuid, text, text)
  TO service_role;

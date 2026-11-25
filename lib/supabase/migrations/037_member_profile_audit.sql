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

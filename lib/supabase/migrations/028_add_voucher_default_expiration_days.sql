-- ============================================================================
-- Add default voucher expiration days setting
-- Date: 2026-09-22
-- Purpose:
--   Let Admin Settings control how long newly created vouchers stay valid.
--   Product default is 90 days (~3 months), replacing the previous 1-year
--   hardcode. Missing or invalid values fall back to 90 days in app code.
-- ============================================================================

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'voucher_default_expiration_days',
    '90',
    'Default number of days a newly created voucher remains valid'
  )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

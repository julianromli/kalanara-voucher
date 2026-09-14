-- ============================================================================
-- Add announcement countdown enabled flag
-- Date: 2026-09-14
-- Purpose:
--   Let CRM turn the public announcement-bar countdown on or off
--   without removing the announcement text or the stored end date.
--   Existing installs default to ON to keep the current live timer.
-- ============================================================================

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'announcement_countdown_enabled',
    'true',
    'Whether the announcement bar shows a countdown timer'
  )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

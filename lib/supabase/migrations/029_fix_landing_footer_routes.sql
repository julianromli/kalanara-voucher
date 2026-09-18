-- ============================================================================
-- Point default landing footer links at implemented public routes
-- Date: 2026-09-18
-- Purpose:
--   Migration 028 seeded placeholder paths that this app does not serve.
--   Replace those hrefs so visitors do not land on 404 pages.
-- ============================================================================

UPDATE public.site_settings
SET value = replace(
  replace(
    replace(
      replace(
        replace(
          replace(value, '"href":"/about"', '"href":"/"'),
          '"href":"/contact"',
          '"href":"/#footer"'
        ),
        '"href":"/how-it-works"',
        '"href":"/#services"'
      ),
      '"href":"/faq"',
      '"href":"/#trust"'
    ),
    '"href":"/terms"',
    '"href":"/"'
  ),
  '"href":"/privacy"',
  '"href":"/"'
)
WHERE key = 'landing_footer';

-- ============================================================================
-- Rewrite only the original landing footer seed's unimplemented routes
-- Date: 2026-09-22
-- Purpose:
--   The first landing-copy seed stored placeholder paths this app does not
--   serve (/about, /contact, /how-it-works, /faq, /terms, /privacy).
--   Rewrite those known seed link pairs to implemented public routes.
--   Skip customized CRM footers that no longer match the original seed links.
--   Idempotent: already-rewritten or customized JSON updates 0 rows.
--
-- Cache:
--   SQL cannot purge Next.js LANDING_CMS_CACHE_TAG ("landing:cms").
--   After this data change on a running app, redeploy or save the Footer
--   section in /admin/crm so updateLandingCopySection() calls updateTag().
-- ============================================================================

UPDATE public.site_settings
SET value = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            value,
            '"name":"Tentang Kami","href":"/about"',
            '"name":"Tentang Kami","href":"/"'
          ),
          '"name":"Hubungi Kami","href":"/contact"',
          '"name":"Hubungi Kami","href":"/#footer"'
        ),
        '"name":"Cara Pembelian","href":"/how-it-works"',
        '"name":"Cara Pembelian","href":"/#services"'
      ),
      '"name":"FAQ","href":"/faq"',
      '"name":"FAQ","href":"/#trust"'
    ),
    '"name":"Syarat & Ketentuan","href":"/terms"',
    '"name":"Syarat & Ketentuan","href":"/"'
  ),
  '"name":"Kebijakan Privasi","href":"/privacy"',
  '"name":"Kebijakan Privasi","href":"/"'
)
WHERE key = 'landing_footer'
  AND value LIKE '%"name":"Tentang Kami","href":"/about"%'
  AND value LIKE '%"name":"Hubungi Kami","href":"/contact"%'
  AND value LIKE '%"name":"Cara Pembelian","href":"/how-it-works"%'
  AND value LIKE '%"name":"FAQ","href":"/faq"%'
  AND value LIKE '%"name":"Syarat & Ketentuan","href":"/terms"%'
  AND value LIKE '%"name":"Kebijakan Privasi","href":"/privacy"%';

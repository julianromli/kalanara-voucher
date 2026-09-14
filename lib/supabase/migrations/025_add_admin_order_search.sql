-- ============================================================================
-- Add bounded, service-aware admin order search
-- Date: 2026-09-14
--
-- Apply notes:
--   1. Apply this migration before deploying the purchases action that calls
--      public.search_admin_orders(text).
--   2. Deploying the migration first is backward compatible; existing list
--      reads continue to use public.orders until the application is deployed.
--   3. Execution is restricted to service_role. The server action performs the
--      existing ORDERS_VIEW permission check before invoking this function.
--   4. The function returns a relation so PostgREST applies exact counts,
--      deterministic ordering, status filters, and 25-row ranges server-side.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_admin_orders(search_query text)
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH search_term AS (
    SELECT
      '%' ||
      REPLACE(
        REPLACE(
          REPLACE(BTRIM(search_query), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) ||
      '%' AS pattern
  )
  SELECT o.*
  FROM public.orders AS o
  CROSS JOIN search_term AS term
  WHERE search_query IS NOT NULL
    AND LENGTH(BTRIM(search_query)) BETWEEN 1 AND 100
    AND (
      o.customer_name ILIKE term.pattern ESCAPE E'\\'
      OR o.customer_email ILIKE term.pattern ESCAPE E'\\'
      OR o.payment_order_id ILIKE term.pattern ESCAPE E'\\'
      OR o.payment_transaction_id ILIKE term.pattern ESCAPE E'\\'
      OR EXISTS (
        SELECT 1
        FROM public.services AS s
        WHERE s.name ILIKE term.pattern ESCAPE E'\\'
          AND (
            s.id = o.service_id
            OR EXISTS (
              SELECT 1
              FROM public.vouchers AS v
              WHERE v.id = o.voucher_id
                AND v.service_id = s.id
            )
            OR EXISTS (
              SELECT 1
              FROM public.order_items AS oi
              WHERE oi.order_id = o.id
                AND oi.service_id = s.id
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.search_admin_orders(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_admin_orders(text)
  TO service_role;

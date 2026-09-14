-- ============================================================================
-- Add bounded admin dashboard aggregates
-- Date: 2026-09-14
--
-- Apply notes:
--   1. Apply this migration before deploying the dashboard action that calls
--      public.get_admin_dashboard_aggregates().
--   2. The function is replaceable and can be applied repeatedly.
--   3. Existing permissions, roles, and row-level security remain untouched.
--      SECURITY INVOKER keeps evaluation in the caller's existing context.
--   4. Validate all totals and seven daily buckets against direct SQL in a
--      staging Supabase project after applying.
--   5. No performance structures are added: representative production data and
--      EXPLAIN (ANALYZE, BUFFERS) evidence are unavailable in this environment.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_aggregates()
RETURNS TABLE (
  total_revenue numeric,
  active_vouchers bigint,
  redeemed_vouchers bigint,
  expired_vouchers bigint,
  total_orders bigint,
  total_vouchers bigint,
  total_reviews bigint,
  average_rating numeric,
  bucket_date date,
  bucket_revenue numeric,
  bucket_orders bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH days AS (
    SELECT
      (CURRENT_DATE - (6 - day_offset)::integer)::date AS bucket_date
    FROM generate_series(0, 6) AS day_offset
  ),
  order_totals AS (
    SELECT
      COALESCE(
        SUM(o.total_amount) FILTER (WHERE o.payment_status = 'COMPLETED'),
        0
      )::numeric AS total_revenue,
      COUNT(*)::bigint AS total_orders
    FROM public.orders AS o
  ),
  voucher_totals AS (
    SELECT
      COUNT(*) FILTER (
        WHERE NOT v.is_redeemed AND v.expiry_date > NOW()
      )::bigint AS active_vouchers,
      COUNT(*) FILTER (WHERE v.is_redeemed)::bigint AS redeemed_vouchers,
      COUNT(*) FILTER (
        WHERE NOT v.is_redeemed AND v.expiry_date <= NOW()
      )::bigint AS expired_vouchers,
      COUNT(*)::bigint AS total_vouchers
    FROM public.vouchers AS v
  ),
  review_totals AS (
    SELECT
      COUNT(*)::bigint AS total_reviews,
      COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0)::numeric AS average_rating
    FROM public.reviews AS r
  ),
  daily_completed_orders AS (
    SELECT
      d.bucket_date,
      COALESCE(SUM(o.total_amount), 0)::numeric AS bucket_revenue,
      COUNT(o.id)::bigint AS bucket_orders
    FROM days AS d
    LEFT JOIN public.orders AS o
      ON o.payment_status = 'COMPLETED'
      AND o.created_at >= d.bucket_date::timestamptz
      AND o.created_at < (d.bucket_date + 1)::timestamptz
    GROUP BY d.bucket_date
  )
  SELECT
    ot.total_revenue,
    vt.active_vouchers,
    vt.redeemed_vouchers,
    vt.expired_vouchers,
    ot.total_orders,
    vt.total_vouchers,
    rt.total_reviews,
    rt.average_rating,
    daily.bucket_date,
    daily.bucket_revenue,
    daily.bucket_orders
  FROM daily_completed_orders AS daily
  CROSS JOIN order_totals AS ot
  CROSS JOIN voucher_totals AS vt
  CROSS JOIN review_totals AS rt
  ORDER BY daily.bucket_date ASC;
$$;

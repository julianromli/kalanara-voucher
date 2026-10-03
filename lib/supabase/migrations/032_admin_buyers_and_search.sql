-- ============================================================================
-- Admin buyer grouping and broader purchase search
-- Date: 2026-10-03
--
-- Apply notes:
--   1. Apply this migration before deploying the buyer and purchase search
--      actions that call these functions.
--   2. Buyers are grouped from existing orders. No customer table is created.
--   3. Execution is restricted to service_role. Server actions check
--      ORDERS_VIEW before calling the functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_admin_phone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN digits = '' THEN ''
    WHEN digits LIKE '0%' THEN '62' || substr(digits, 2)
    WHEN digits LIKE '62%' THEN digits
    WHEN digits LIKE '8%' THEN '62' || digits
    ELSE digits
  END
  FROM (
    SELECT regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') AS digits
  ) AS parsed;
$$;

CREATE OR REPLACE FUNCTION public.admin_text_matches(value text, search_query text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT length(btrim(coalesce(search_query, ''))) BETWEEN 1 AND 100
    AND strpos(
      lower(coalesce(value, '')),
      lower(btrim(search_query))
    ) > 0;
$$;

CREATE OR REPLACE FUNCTION public.search_admin_orders(search_query text)
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT o.*
  FROM public.orders AS o
  WHERE search_query IS NOT NULL
    AND length(btrim(search_query)) BETWEEN 1 AND 100
    AND (
      public.admin_text_matches(o.customer_name, search_query)
      OR public.admin_text_matches(o.customer_email, search_query)
      OR public.admin_text_matches(o.customer_phone, search_query)
      OR public.admin_text_matches(public.normalize_admin_phone(o.customer_phone), search_query)
      OR public.admin_text_matches(o.payment_order_id, search_query)
      OR public.admin_text_matches(o.payment_transaction_id, search_query)
      OR EXISTS (
        SELECT 1
        FROM public.vouchers AS v
        WHERE public.admin_text_matches(v.code, search_query)
          AND (
            v.id = o.voucher_id
            OR v.source_order_id = o.id
            OR EXISTS (
              SELECT 1
              FROM public.order_items AS oi
              WHERE oi.order_id = o.id
                AND oi.voucher_id = v.id
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.services AS s
        WHERE public.admin_text_matches(s.name, search_query)
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

CREATE OR REPLACE FUNCTION public.list_admin_buyers(search_query text)
RETURNS TABLE (
  phone text,
  customer_name text,
  customer_email text,
  order_count bigint,
  voucher_count bigint,
  last_order_at timestamptz,
  other_names text[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT
      o.*,
      public.normalize_admin_phone(o.customer_phone) AS buyer_phone
    FROM public.orders AS o
    WHERE public.normalize_admin_phone(o.customer_phone) <> ''
  ),
  grouped AS (
    SELECT
      buyer_phone,
      count(*) AS order_count,
      max(created_at) AS last_order_at
    FROM normalized
    GROUP BY buyer_phone
  ),
  latest AS (
    SELECT DISTINCT ON (buyer_phone)
      buyer_phone,
      customer_name,
      customer_email
    FROM normalized
    ORDER BY buyer_phone, created_at DESC, id DESC
  ),
  names AS (
    SELECT
      buyer_phone,
      array_agg(DISTINCT btrim(customer_name)) AS all_names
    FROM normalized
    GROUP BY buyer_phone
  ),
  voucher_counts AS (
    SELECT
      buyer_phone,
      count(DISTINCT voucher_id) AS voucher_count
    FROM (
      SELECT buyer_phone, voucher_id
      FROM normalized
      WHERE voucher_id IS NOT NULL
      UNION
      SELECT n.buyer_phone, oi.voucher_id
      FROM public.order_items AS oi
      JOIN normalized AS n ON n.id = oi.order_id
      WHERE oi.voucher_id IS NOT NULL
    ) AS voucher_ids
    GROUP BY buyer_phone
  )
  SELECT
    grouped.buyer_phone,
    latest.customer_name,
    latest.customer_email,
    grouped.order_count,
    coalesce(voucher_counts.voucher_count, 0),
    grouped.last_order_at,
    ARRAY(
      SELECT name_value
      FROM unnest(names.all_names) AS name_value
      WHERE name_value IS DISTINCT FROM latest.customer_name
      ORDER BY name_value
    )
  FROM grouped
  JOIN latest ON latest.buyer_phone = grouped.buyer_phone
  JOIN names ON names.buyer_phone = grouped.buyer_phone
  LEFT JOIN voucher_counts ON voucher_counts.buyer_phone = grouped.buyer_phone
  WHERE search_query IS NULL
    OR length(btrim(search_query)) = 0
    OR (
      length(btrim(search_query)) BETWEEN 1 AND 100
      AND (
        public.admin_text_matches(latest.customer_name, search_query)
        OR public.admin_text_matches(latest.customer_email, search_query)
        OR public.admin_text_matches(grouped.buyer_phone, search_query)
        OR EXISTS (
          SELECT 1
          FROM normalized AS n
          WHERE n.buyer_phone = grouped.buyer_phone
            AND (
              public.admin_text_matches(n.customer_name, search_query)
              OR public.admin_text_matches(n.customer_email, search_query)
              OR public.admin_text_matches(n.customer_phone, search_query)
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.vouchers AS v
          JOIN normalized AS n ON n.buyer_phone = grouped.buyer_phone
          WHERE public.admin_text_matches(v.code, search_query)
            AND (
              v.id = n.voucher_id
              OR v.source_order_id = n.id
              OR EXISTS (
                SELECT 1
                FROM public.order_items AS oi
                WHERE oi.order_id = n.id
                  AND oi.voucher_id = v.id
              )
            )
        )
      )
    )
  ORDER BY grouped.last_order_at DESC, grouped.buyer_phone;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_buyer_orders(buyer_phone text)
RETURNS SETOF public.orders
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT o.*
  FROM public.orders AS o
  WHERE public.normalize_admin_phone(o.customer_phone) = public.normalize_admin_phone(buyer_phone)
  ORDER BY o.created_at DESC, o.id DESC;
$$;

REVOKE ALL ON FUNCTION public.normalize_admin_phone(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_admin_phone(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_text_matches(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_text_matches(text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.search_admin_orders(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_admin_orders(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.list_admin_buyers(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_buyers(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.list_admin_buyer_orders(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_buyer_orders(text)
  TO service_role;

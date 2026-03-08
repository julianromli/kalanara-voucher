-- ============================================================================
-- Harden public RLS policies for payment and voucher data
-- Date: 2026-03-08
-- Purpose:
--   1. Remove permissive public INSERT access on sensitive tables.
--   2. Recreate policies with explicit roles and cached helper calls.
--   3. Add an index on reviews.voucher_id for foreign-key lookups.
-- ============================================================================

-- ============================================================================
-- SERVICES
-- ============================================================================

DROP POLICY IF EXISTS "services_select" ON public.services;
DROP POLICY IF EXISTS "services_insert" ON public.services;
DROP POLICY IF EXISTS "services_update" ON public.services;
DROP POLICY IF EXISTS "services_delete" ON public.services;

CREATE POLICY "services_select" ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR (SELECT public.is_admin()));

CREATE POLICY "services_insert" ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "services_update" ON public.services
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "services_delete" ON public.services
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ============================================================================
-- VOUCHERS
-- Keep public SELECT for the current verification flow, but remove public writes.
-- ============================================================================

DROP POLICY IF EXISTS "vouchers_select" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_insert" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_update" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_delete" ON public.vouchers;

CREATE POLICY "vouchers_select" ON public.vouchers
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "vouchers_insert" ON public.vouchers
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "vouchers_update" ON public.vouchers
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "vouchers_delete" ON public.vouchers
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ============================================================================
-- ORDERS
-- Orders contain financial and recipient data, so public API writes are removed.
-- ============================================================================

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

CREATE POLICY "orders_select" ON public.orders
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ============================================================================
-- REVIEWS
-- Public reads remain open, but inserts now require trusted server/admin paths.
-- ============================================================================

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
DROP POLICY IF EXISTS "reviews_update" ON public.reviews;
DROP POLICY IF EXISTS "reviews_delete" ON public.reviews;

CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "reviews_update" ON public.reviews
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "reviews_delete" ON public.reviews
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE INDEX IF NOT EXISTS idx_reviews_voucher_id
  ON public.reviews (voucher_id);

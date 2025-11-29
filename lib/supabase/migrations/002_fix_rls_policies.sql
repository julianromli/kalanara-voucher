-- ============================================================================
-- FIX: RLS Policy Infinite Recursion
-- Run this in Supabase SQL Editor to fix the infinite recursion error
-- ============================================================================

-- Drop all existing policies first
DROP POLICY IF EXISTS "services_public_read" ON services;
DROP POLICY IF EXISTS "services_admin_all" ON services;
DROP POLICY IF EXISTS "vouchers_public_read_by_code" ON vouchers;
DROP POLICY IF EXISTS "vouchers_admin_all" ON vouchers;
DROP POLICY IF EXISTS "vouchers_anon_insert" ON vouchers;
DROP POLICY IF EXISTS "orders_admin_all" ON orders;
DROP POLICY IF EXISTS "orders_anon_insert" ON orders;
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
DROP POLICY IF EXISTS "reviews_public_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_admin_all" ON reviews;
DROP POLICY IF EXISTS "admins_read_own" ON admins;
DROP POLICY IF EXISTS "admins_super_admin_read" ON admins;
DROP POLICY IF EXISTS "admins_super_admin_all" ON admins;

-- Drop existing helper functions if any
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS is_super_admin();

-- ============================================================================
-- Create SECURITY DEFINER functions to check admin status
-- These bypass RLS to avoid infinite recursion
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SERVICES POLICIES (Simplified)
-- ============================================================================

-- Anyone can read active services
CREATE POLICY "services_select" ON services
  FOR SELECT USING (is_active = true OR is_admin());

-- Only admins can insert/update/delete
CREATE POLICY "services_insert" ON services
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "services_update" ON services
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "services_delete" ON services
  FOR DELETE USING (is_admin());

-- ============================================================================
-- VOUCHERS POLICIES (Simplified)
-- ============================================================================

-- Anyone can read vouchers (for verification)
CREATE POLICY "vouchers_select" ON vouchers
  FOR SELECT USING (true);

-- Anyone can insert (purchase flow)
CREATE POLICY "vouchers_insert" ON vouchers
  FOR INSERT WITH CHECK (true);

-- Only admins can update/delete
CREATE POLICY "vouchers_update" ON vouchers
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "vouchers_delete" ON vouchers
  FOR DELETE USING (is_admin());

-- ============================================================================
-- ORDERS POLICIES (Simplified)
-- ============================================================================

-- Admins can read all orders
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (is_admin());

-- Anyone can insert (purchase flow)
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (true);

-- Only admins can update/delete
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (is_admin());

-- ============================================================================
-- REVIEWS POLICIES (Simplified)
-- ============================================================================

-- Anyone can read reviews
CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (true);

-- Anyone can insert reviews
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (true);

-- Only admins can update/delete (moderation)
CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "reviews_delete" ON reviews
  FOR DELETE USING (is_admin());

-- ============================================================================
-- ADMINS POLICIES (Simplified - no recursion)
-- ============================================================================

-- Admins can only read their own record (using auth.uid() directly)
CREATE POLICY "admins_select" ON admins
  FOR SELECT USING (id = auth.uid());

-- No insert/update/delete via API (manage via Supabase Dashboard)

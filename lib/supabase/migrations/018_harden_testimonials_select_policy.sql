-- ============================================================================
-- Harden testimonials SELECT policy
-- Date: 2026-05-05
-- Purpose:
--   Ensure public clients can only read active testimonials while CRM managers
--   and admins retain full testimonial visibility.
-- ============================================================================

DROP POLICY IF EXISTS "testimonials_select" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_select_public_active" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_select_crm_manage" ON public.testimonials;

CREATE POLICY "testimonials_select_public_active" ON public.testimonials
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "testimonials_select_crm_manage" ON public.testimonials
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_crm()));

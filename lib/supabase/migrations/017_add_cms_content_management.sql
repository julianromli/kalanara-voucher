-- ============================================================================
-- Add CMS content management tables and CRM-specific policies
-- Date: 2026-05-05
-- Purpose:
--   1. Track CMS tables in git so fresh environments match production.
--   2. Seed required site setting rows for announcement and hero image.
--   3. Align database write access with app-level CRM permissions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_key_not_blank CHECK (btrim(key) <> ''),
  CONSTRAINT site_settings_value_not_blank CHECK (btrim(value) <> '')
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  for_text text NOT NULL,
  quote text NOT NULL,
  initials text NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT testimonials_for_text_not_blank CHECK (btrim(for_text) <> ''),
  CONSTRAINT testimonials_quote_not_blank CHECK (btrim(quote) <> ''),
  CONSTRAINT testimonials_initials_not_blank CHECK (btrim(initials) <> ''),
  CONSTRAINT testimonials_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT testimonials_location_not_blank CHECK (btrim(location) <> ''),
  CONSTRAINT testimonials_sort_order_non_negative CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_testimonials_active_sort_order
  ON public.testimonials (is_active, sort_order, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_manage_crm()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.id = auth.uid()
      AND admins.role IN ('SUPER_ADMIN', 'MANAGER')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trigger_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_testimonials_updated_at ON public.testimonials;
CREATE TRIGGER trigger_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.site_settings;
DROP POLICY IF EXISTS "Public read access" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_select" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_insert" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_update" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_delete" ON public.site_settings;

CREATE POLICY "site_settings_select" ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "site_settings_insert" ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.can_manage_crm()));

CREATE POLICY "site_settings_update" ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.can_manage_crm()))
  WITH CHECK ((SELECT public.can_manage_crm()));

CREATE POLICY "site_settings_delete" ON public.site_settings
  FOR DELETE
  TO authenticated
  USING ((SELECT public.can_manage_crm()));

DROP POLICY IF EXISTS "Admin full access" ON public.testimonials;
DROP POLICY IF EXISTS "Public read access" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_select" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_select_public_active" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_select_crm_manage" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_insert" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_update" ON public.testimonials;
DROP POLICY IF EXISTS "testimonials_delete" ON public.testimonials;

CREATE POLICY "testimonials_select_public_active" ON public.testimonials
  FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "testimonials_select_crm_manage" ON public.testimonials
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_crm()));

CREATE POLICY "testimonials_insert" ON public.testimonials
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.can_manage_crm()));

CREATE POLICY "testimonials_update" ON public.testimonials
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.can_manage_crm()))
  WITH CHECK ((SELECT public.can_manage_crm()));

CREATE POLICY "testimonials_delete" ON public.testimonials
  FOR DELETE
  TO authenticated
  USING ((SELECT public.can_manage_crm()));

INSERT INTO public.site_settings (key, value, description)
VALUES
  (
    'announcement_text',
    'FLASH SALE 5.5 ...... BERAKHIR DALAM ',
    'Text for announcement bar at the top of the page'
  ),
  (
    'hero_image_url',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1920&q=80',
    'Background image for the hero section'
  )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

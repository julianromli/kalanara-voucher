-- ============================================================================
-- Add relational service categories with transition-safe backfill
-- Date: 2026-03-25
-- Purpose:
--   1. Create public.service_categories as the additive category source of truth.
--   2. Add public.services.category_id with ON DELETE RESTRICT.
--   3. Backfill existing services and keep legacy enum writes transition-safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT service_categories_slug_not_blank CHECK (btrim(slug) <> ''),
  CONSTRAINT service_categories_slug_lowercase CHECK (slug = lower(slug)),
  CONSTRAINT service_categories_slug_no_whitespace CHECK (slug !~ '\\s'),
  CONSTRAINT service_categories_sort_order_non_negative CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_slug
  ON public.service_categories (slug);

CREATE INDEX IF NOT EXISTS idx_service_categories_is_active
  ON public.service_categories (is_active);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id uuid;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_category_id_fkey;

ALTER TABLE public.services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.service_categories(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_services_category_id
  ON public.services (category_id);

INSERT INTO public.service_categories (slug, name, sort_order, is_active)
VALUES
  ('massage', 'Massage', 0, true),
  ('facial', 'Facial', 1, true),
  ('body-treatment', 'Body Treatment', 2, true),
  ('package', 'Package', 3, true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

UPDATE public.services AS services
SET category_id = service_categories.id
FROM public.service_categories AS service_categories
WHERE services.category_id IS NULL
  AND service_categories.slug = CASE services.category
    WHEN 'MASSAGE' THEN 'massage'
    WHEN 'FACIAL' THEN 'facial'
    WHEN 'BODY_TREATMENT' THEN 'body-treatment'
    WHEN 'PACKAGE' THEN 'package'
    ELSE NULL
  END;

CREATE OR REPLACE FUNCTION public.sync_service_category_id_from_legacy()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
      SELECT service_categories.id INTO NEW.category_id
      FROM public.service_categories AS service_categories
      WHERE service_categories.slug = CASE NEW.category
        WHEN 'MASSAGE' THEN 'massage'
        WHEN 'FACIAL' THEN 'facial'
        WHEN 'BODY_TREATMENT' THEN 'body-treatment'
        WHEN 'PACKAGE' THEN 'package'
        ELSE NULL
      END;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.category IS DISTINCT FROM OLD.category THEN
    SELECT service_categories.id INTO NEW.category_id
    FROM public.service_categories AS service_categories
    WHERE service_categories.slug = CASE NEW.category
      WHEN 'MASSAGE' THEN 'massage'
      WHEN 'FACIAL' THEN 'facial'
      WHEN 'BODY_TREATMENT' THEN 'body-treatment'
      WHEN 'PACKAGE' THEN 'package'
      ELSE NULL
    END;
  ELSIF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT service_categories.id INTO NEW.category_id
    FROM public.service_categories AS service_categories
    WHERE service_categories.slug = CASE NEW.category
      WHEN 'MASSAGE' THEN 'massage'
      WHEN 'FACIAL' THEN 'facial'
      WHEN 'BODY_TREATMENT' THEN 'body-treatment'
      WHEN 'PACKAGE' THEN 'package'
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_services_sync_category_id ON public.services;

CREATE TRIGGER trigger_services_sync_category_id
  BEFORE INSERT OR UPDATE OF category, category_id ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_service_category_id_from_legacy();

DROP TRIGGER IF EXISTS trigger_service_categories_updated_at ON public.service_categories;

CREATE TRIGGER trigger_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
DROP POLICY IF EXISTS "service_categories_insert" ON public.service_categories;
DROP POLICY IF EXISTS "service_categories_update" ON public.service_categories;
DROP POLICY IF EXISTS "service_categories_delete" ON public.service_categories;

CREATE POLICY "service_categories_select" ON public.service_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR (SELECT public.is_admin()));

CREATE POLICY "service_categories_insert" ON public.service_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "service_categories_update" ON public.service_categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "service_categories_delete" ON public.service_categories
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

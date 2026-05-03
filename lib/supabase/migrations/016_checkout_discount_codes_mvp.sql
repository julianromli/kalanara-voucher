CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  normalized_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL CHECK (discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_total_uses integer CHECK (max_total_uses IS NULL OR max_total_uses >= 0),
  max_uses_per_customer integer CHECK (
    max_uses_per_customer IS NULL OR max_uses_per_customer >= 0
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_code_nonempty CHECK (length(trim(code)) > 0),
  CONSTRAINT discount_codes_normalized_code_nonempty CHECK (
    length(trim(normalized_code)) > 0
  ),
  CONSTRAINT discount_codes_valid_window CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

CREATE UNIQUE INDEX idx_discount_codes_normalized_code_unique
ON public.discount_codes(normalized_code);

CREATE INDEX idx_discount_codes_active_window
ON public.discount_codes(is_active, starts_at, ends_at);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_codes_select
ON public.discount_codes
FOR SELECT
TO authenticated
USING ((SELECT is_admin()));

CREATE POLICY discount_codes_insert
ON public.discount_codes
FOR INSERT
TO authenticated
WITH CHECK ((SELECT is_admin()));

CREATE POLICY discount_codes_update
ON public.discount_codes
FOR UPDATE
TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));

CREATE POLICY discount_codes_delete
ON public.discount_codes
FOR DELETE
TO authenticated
USING ((SELECT is_admin()));

CREATE POLICY discount_codes_deny_anon
ON public.discount_codes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE TRIGGER trigger_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discount_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email_normalized text NOT NULL,
  customer_phone_normalized text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'VOID')),
  discount_snapshot_type text NOT NULL CHECK (
    discount_snapshot_type IN ('FIXED_AMOUNT', 'PERCENTAGE')
  ),
  discount_snapshot_value numeric(12,2) NOT NULL CHECK (discount_snapshot_value >= 0),
  subtotal_amount integer NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount integer NOT NULL CHECK (discount_amount >= 0),
  final_total_amount integer NOT NULL CHECK (final_total_amount >= 0),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_code_redemptions_order_unique UNIQUE (order_id),
  CONSTRAINT discount_code_redemptions_amounts_consistent CHECK (
    subtotal_amount - discount_amount = final_total_amount
  )
);

CREATE INDEX idx_discount_code_redemptions_code_status
ON public.discount_code_redemptions(discount_code_id, status);

CREATE INDEX idx_discount_code_redemptions_code_email_status
ON public.discount_code_redemptions(discount_code_id, customer_email_normalized, status);

CREATE INDEX idx_discount_code_redemptions_code_phone_status
ON public.discount_code_redemptions(discount_code_id, customer_phone_normalized, status);

ALTER TABLE public.discount_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_code_redemptions_select
ON public.discount_code_redemptions
FOR SELECT
TO authenticated
USING ((SELECT is_admin()));

CREATE POLICY discount_code_redemptions_insert
ON public.discount_code_redemptions
FOR INSERT
TO authenticated
WITH CHECK ((SELECT is_admin()));

CREATE POLICY discount_code_redemptions_update
ON public.discount_code_redemptions
FOR UPDATE
TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));

CREATE POLICY discount_code_redemptions_delete
ON public.discount_code_redemptions
FOR DELETE
TO authenticated
USING ((SELECT is_admin()));

CREATE POLICY discount_code_redemptions_deny_anon
ON public.discount_code_redemptions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE TRIGGER trigger_discount_code_redemptions_updated_at
BEFORE UPDATE ON public.discount_code_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN subtotal_amount integer,
  ADD COLUMN discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN discount_code text,
  ADD COLUMN discount_type_snapshot text,
  ADD COLUMN discount_value_snapshot numeric(12,2),
  ADD COLUMN discount_amount integer;

UPDATE public.orders
SET subtotal_amount = total_amount,
    discount_amount = 0
WHERE subtotal_amount IS NULL
   OR discount_amount IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN subtotal_amount SET NOT NULL,
  ALTER COLUMN subtotal_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_subtotal_amount_nonnegative CHECK (subtotal_amount >= 0),
  ADD CONSTRAINT orders_discount_amount_nonnegative CHECK (discount_amount >= 0),
  ADD CONSTRAINT orders_discount_type_snapshot_check CHECK (
    discount_type_snapshot IS NULL OR discount_type_snapshot IN ('FIXED_AMOUNT', 'PERCENTAGE')
  ),
  ADD CONSTRAINT orders_discount_totals_consistent CHECK (
    subtotal_amount - discount_amount = total_amount
  );

CREATE INDEX idx_orders_discount_code_id
ON public.orders(discount_code_id);

ALTER TABLE public.order_items
  ADD COLUMN original_unit_price integer,
  ADD COLUMN discount_amount integer,
  ADD COLUMN final_unit_price integer;

UPDATE public.order_items
SET original_unit_price = unit_price,
    discount_amount = 0,
    final_unit_price = unit_price
WHERE original_unit_price IS NULL
   OR discount_amount IS NULL
   OR final_unit_price IS NULL;

ALTER TABLE public.order_items
  ALTER COLUMN original_unit_price SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN final_unit_price SET NOT NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_original_unit_price_nonnegative CHECK (original_unit_price >= 0),
  ADD CONSTRAINT order_items_discount_amount_nonnegative CHECK (discount_amount >= 0),
  ADD CONSTRAINT order_items_final_unit_price_nonnegative CHECK (final_unit_price >= 0),
  ADD CONSTRAINT order_items_discount_totals_consistent CHECK (
    original_unit_price - discount_amount = final_unit_price
  ),
  ADD CONSTRAINT order_items_unit_price_matches_final CHECK (
    unit_price = final_unit_price
  );

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  voucher_id uuid REFERENCES public.vouchers(id) ON DELETE SET NULL,
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  recipient_name text NOT NULL,
  recipient_email text,
  recipient_phone text,
  sender_message text,
  delivery_method text NOT NULL CHECK (delivery_method IN ('EMAIL', 'WHATSAPP', 'BOTH')),
  send_to text NOT NULL CHECK (send_to IN ('PURCHASER', 'RECIPIENT')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON public.order_items(order_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_service_id
ON public.order_items(service_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_voucher_id_unique
ON public.order_items(voucher_id)
WHERE voucher_id IS NOT NULL;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin full access to order items" ON public.order_items;
CREATE POLICY "Allow admin full access to order items"
ON public.order_items
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Deny public direct access to order items" ON public.order_items;
CREATE POLICY "Deny public direct access to order items"
ON public.order_items
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

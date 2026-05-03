ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS source_order_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vouchers_source_order_item_id_fkey'
      AND conrelid = 'public.vouchers'::regclass
  ) THEN
    ALTER TABLE public.vouchers
    ADD CONSTRAINT vouchers_source_order_item_id_fkey
    FOREIGN KEY (source_order_item_id)
    REFERENCES public.order_items(id)
    ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.vouchers AS vouchers
SET source_order_item_id = order_items.id
FROM public.order_items AS order_items
WHERE order_items.voucher_id = vouchers.id
  AND vouchers.source_order_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_source_order_item_id_unique
ON public.vouchers(source_order_item_id)
WHERE source_order_item_id IS NOT NULL;

ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_source_order_id
ON public.vouchers (source_order_id)
WHERE source_order_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vouchers_source_order_id_unique'
      AND conrelid = 'public.vouchers'::regclass
  ) THEN
    ALTER TABLE public.vouchers
    ADD CONSTRAINT vouchers_source_order_id_unique UNIQUE (source_order_id);
  END IF;
END $$;

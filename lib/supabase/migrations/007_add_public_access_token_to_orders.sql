ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS public_access_token text;

UPDATE public.orders
SET public_access_token = encode(gen_random_bytes(24), 'hex')
WHERE public_access_token IS NULL;

ALTER TABLE public.orders
ALTER COLUMN public_access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_access_token
ON public.orders (public_access_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_order_public_access
ON public.orders (payment_order_id, public_access_token);

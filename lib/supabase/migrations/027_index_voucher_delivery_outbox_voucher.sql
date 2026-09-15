-- Cover the voucher foreign key for cascades and voucher-scoped lookups.
CREATE INDEX IF NOT EXISTS voucher_delivery_outbox_voucher_id_idx
  ON public.voucher_delivery_outbox(voucher_id);

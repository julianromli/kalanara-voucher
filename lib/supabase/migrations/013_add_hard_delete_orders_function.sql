CREATE OR REPLACE FUNCTION public.hard_delete_orders(order_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  success boolean,
  message text,
  deleted_order_count integer,
  deleted_voucher_count integer,
  deleted_review_count integer,
  deleted_webhook_event_count integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_order_ids uuid[];
  related_voucher_ids uuid[];
  conflicting_order_count integer := 0;
BEGIN
  SELECT COALESCE(array_agg(orders.id), '{}'::uuid[])
  INTO target_order_ids
  FROM public.orders
  WHERE order_ids IS NULL OR orders.id = ANY(order_ids);

  IF COALESCE(array_length(target_order_ids, 1), 0) = 0 THEN
    RETURN QUERY
    SELECT false, 'Tidak ada pembelian yang dapat dihapus permanen.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT vouchers.id), '{}'::uuid[])
  INTO related_voucher_ids
  FROM public.vouchers
  WHERE vouchers.id IN (
      SELECT orders.voucher_id
      FROM public.orders
      WHERE orders.id = ANY(target_order_ids)
        AND orders.voucher_id IS NOT NULL
    )
    OR vouchers.source_order_id = ANY(target_order_ids);

  IF order_ids IS NOT NULL AND COALESCE(array_length(related_voucher_ids, 1), 0) > 0 THEN
    SELECT COUNT(*)
    INTO conflicting_order_count
    FROM public.orders
    WHERE orders.id <> ALL(target_order_ids)
      AND orders.voucher_id = ANY(related_voucher_ids);

    IF conflicting_order_count > 0 THEN
      RETURN QUERY
      SELECT false, 'Pembelian ini tidak dapat dihapus permanen karena voucher terkait masih dipakai pembelian lain.', 0, 0, 0, 0;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH deleted_webhooks AS (
    DELETE FROM public.scalev_webhook_events
    WHERE scalev_webhook_events.order_id = ANY(target_order_ids)
    RETURNING id
  ), detached_orders AS (
    UPDATE public.orders
    SET voucher_id = NULL
    WHERE public.orders.id = ANY(target_order_ids)
      AND public.orders.voucher_id = ANY(related_voucher_ids)
    RETURNING id
  ), deleted_reviews AS (
    DELETE FROM public.reviews
    WHERE COALESCE(array_length(related_voucher_ids, 1), 0) > 0
      AND public.reviews.voucher_id = ANY(related_voucher_ids)
    RETURNING id
  ), deleted_vouchers AS (
    DELETE FROM public.vouchers
    WHERE COALESCE(array_length(related_voucher_ids, 1), 0) > 0
      AND public.vouchers.id = ANY(related_voucher_ids)
    RETURNING id
  ), deleted_orders AS (
    DELETE FROM public.orders
    WHERE public.orders.id = ANY(target_order_ids)
    RETURNING id
  )
  SELECT
    true,
    CASE
      WHEN (SELECT COUNT(*) FROM deleted_orders) = 1 THEN 'Pembelian berhasil dihapus permanen.'
      ELSE (SELECT COUNT(*) FROM deleted_orders)::text || ' pembelian berhasil dihapus permanen.'
    END,
    (SELECT COUNT(*)::integer FROM deleted_orders),
    (SELECT COUNT(*)::integer FROM deleted_vouchers),
    (SELECT COUNT(*)::integer FROM deleted_reviews),
    (SELECT COUNT(*)::integer FROM deleted_webhooks);
END;
$$;

COMMENT ON FUNCTION public.hard_delete_orders(uuid[]) IS
  'Atomically hard deletes orders and their related vouchers, reviews, and Scalev webhook events. Refuses single-order deletes that would mutate unrelated orders.';

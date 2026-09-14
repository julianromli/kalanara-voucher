-- ============================================================================
-- Harden already-deployed payment and fulfillment paths
-- Date: 2026-09-14
--
-- Apply notes:
--   1. Apply after migrations 020-023.
--   2. This replaces hard_delete_orders so item-linked and item-sourced
--      vouchers are collected before order_items cascade with their order.
--   3. The obsolete migration-003 anonymous update policy is removed again
--      here for databases that already applied the earlier migration history.
--   4. After applying, verify anon cannot UPDATE orders and hard-delete a
--      disposable multi-item order to confirm vouchers/reviews are removed.
-- ============================================================================

DROP POLICY IF EXISTS "orders_anon_update" ON public.orders;

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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_order_ids uuid[];
  target_order_item_ids uuid[];
  related_voucher_ids uuid[];
  conflicting_reference_count integer := 0;
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

  SELECT COALESCE(array_agg(order_items.id), '{}'::uuid[])
  INTO target_order_item_ids
  FROM public.order_items
  WHERE order_items.order_id = ANY(target_order_ids);

  SELECT COALESCE(array_agg(DISTINCT vouchers.id), '{}'::uuid[])
  INTO related_voucher_ids
  FROM public.vouchers
  WHERE vouchers.id IN (
      SELECT orders.voucher_id
      FROM public.orders
      WHERE orders.id = ANY(target_order_ids)
        AND orders.voucher_id IS NOT NULL
    )
    OR vouchers.source_order_id = ANY(target_order_ids)
    OR vouchers.id IN (
      SELECT order_items.voucher_id
      FROM public.order_items
      WHERE order_items.order_id = ANY(target_order_ids)
        AND order_items.voucher_id IS NOT NULL
    )
    OR vouchers.source_order_item_id IN (
      SELECT order_items.id
      FROM public.order_items
      WHERE order_items.order_id = ANY(target_order_ids)
    );

  IF order_ids IS NOT NULL
    AND COALESCE(array_length(related_voucher_ids, 1), 0) > 0
  THEN
    SELECT
      (SELECT COUNT(*)
       FROM public.orders
       WHERE orders.id <> ALL(target_order_ids)
         AND orders.voucher_id = ANY(related_voucher_ids))
      +
      (SELECT COUNT(*)
       FROM public.order_items
       WHERE order_items.order_id <> ALL(target_order_ids)
         AND order_items.voucher_id = ANY(related_voucher_ids))
    INTO conflicting_reference_count;

    IF conflicting_reference_count > 0 THEN
      RETURN QUERY
      SELECT false, 'Pembelian ini tidak dapat dihapus permanen karena voucher terkait masih dipakai pembelian lain.', 0, 0, 0, 0;
      RETURN;
    END IF;
  END IF;

  DELETE FROM public.scalev_webhook_events
  WHERE scalev_webhook_events.order_id = ANY(target_order_ids);
  GET DIAGNOSTICS deleted_webhook_event_count = ROW_COUNT;

  UPDATE public.orders
  SET voucher_id = NULL
  WHERE public.orders.id = ANY(target_order_ids)
    AND public.orders.voucher_id = ANY(related_voucher_ids);

  UPDATE public.order_items
  SET voucher_id = NULL
  WHERE public.order_items.id = ANY(target_order_item_ids)
    AND public.order_items.voucher_id = ANY(related_voucher_ids);

  DELETE FROM public.reviews
  WHERE public.reviews.voucher_id = ANY(related_voucher_ids);
  GET DIAGNOSTICS deleted_review_count = ROW_COUNT;

  DELETE FROM public.vouchers
  WHERE public.vouchers.id = ANY(related_voucher_ids);
  GET DIAGNOSTICS deleted_voucher_count = ROW_COUNT;

  DELETE FROM public.orders
  WHERE public.orders.id = ANY(target_order_ids);
  GET DIAGNOSTICS deleted_order_count = ROW_COUNT;

  RETURN QUERY
  SELECT
    true,
    CASE
      WHEN deleted_order_count = 1
        THEN 'Pembelian berhasil dihapus permanen.'
      ELSE deleted_order_count::text
        || ' pembelian berhasil dihapus permanen.'
    END,
    deleted_order_count,
    deleted_voucher_count,
    deleted_review_count,
    deleted_webhook_event_count;
END;
$$;

COMMENT ON FUNCTION public.hard_delete_orders(uuid[]) IS
  'Atomically hard deletes orders plus root/item vouchers, reviews, and Scalev webhook events without leaving item voucher orphans.';

REVOKE ALL ON FUNCTION public.hard_delete_orders(uuid[])
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_orders(uuid[])
  TO service_role;

CREATE OR REPLACE FUNCTION public.hard_delete_voucher(target_voucher_id uuid)
RETURNS TABLE (
  success boolean,
  message text,
  detached_order_count integer,
  deleted_review_count integer,
  deleted_voucher_count integer
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  voucher_exists boolean := false;
BEGIN
  IF target_voucher_id IS NULL THEN
    RETURN QUERY
    SELECT false, 'ID voucher tidak valid.', 0, 0, 0;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.vouchers
    WHERE id = target_voucher_id
  )
  INTO voucher_exists;

  IF NOT voucher_exists THEN
    RETURN QUERY
    SELECT false, 'Voucher tidak ditemukan.', 0, 0, 0;
    RETURN;
  END IF;

  RETURN QUERY
  WITH detached_orders AS (
    UPDATE public.orders
    SET voucher_id = NULL
    WHERE public.orders.voucher_id = target_voucher_id
    RETURNING id
  ), deleted_reviews AS (
    DELETE FROM public.reviews
    WHERE public.reviews.voucher_id = target_voucher_id
    RETURNING id
  ), deleted_voucher AS (
    DELETE FROM public.vouchers
    WHERE public.vouchers.id = target_voucher_id
    RETURNING id
  )
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM deleted_voucher) = 1 THEN true
      ELSE false
    END,
    CASE
      WHEN (SELECT COUNT(*) FROM deleted_voucher) = 1 THEN 'Voucher berhasil dihapus permanen.'
      ELSE 'Voucher gagal dihapus permanen.'
    END,
    (SELECT COUNT(*)::integer FROM detached_orders),
    (SELECT COUNT(*)::integer FROM deleted_reviews),
    (SELECT COUNT(*)::integer FROM deleted_voucher);
END;
$$;

COMMENT ON FUNCTION public.hard_delete_voucher(uuid) IS
  'Atomically detaches related orders, deletes reviews, and permanently deletes a voucher.';

-- ============================================================================
-- Admin voucher resend: audit log, rate limit and recipient email fix
-- Date: 2026-11-27
--
-- Apply notes:
--   1. Apply this file before merging the resend server actions.
--   2. Do not add anon or authenticated policies. Server code uses the
--      service-role client, same as 037 and 038.
--   3. Do not apply from the app or CI. A person must run this on the
--      live project after review.
--
-- Rules:
--   - Every admin role can resend. The server action checks
--     ORDERS_RESEND_VOUCHER before it calls these functions.
--   - Only a voucher from a COMPLETED order that is not redeemed and not
--     expired can be resent. The voucher must belong to the given order,
--     through order_items.voucher_id or the legacy orders.voucher_id.
--   - Email resends per voucher: at most 3 in a rolling hour and at least
--     60 seconds apart. Failed attempts count too, so a bad address cannot
--     be retried in a loop.
--   - voucher_resend_begin writes the audit row as PENDING before any email
--     goes out. The row id is the provider idempotency key, so a double click
--     sends once and each approved resend sends a new email.
--   - voucher_resend_finish marks the row SENT or FAILED. When the admin asked
--     to save the address and the send worked, vouchers.recipient_email is
--     updated and the old value stays on the row.
--   - Copying a WhatsApp link sends nothing. It is logged as COPIED so the
--     history shows who shared the voucher and to which number.
-- ============================================================================

CREATE TABLE public.voucher_delivery_resends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items (id) ON DELETE CASCADE,
  channel text NOT NULL,
  target_kind text NOT NULL,
  target_email text,
  target_phone text,
  save_as_recipient boolean NOT NULL DEFAULT false,
  previous_recipient_email text,
  recipient_email_updated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'PENDING',
  provider_message_id text,
  error text,
  requested_by uuid,
  requested_by_email text,
  requested_by_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT voucher_delivery_resends_channel_known CHECK (
    channel IN ('EMAIL', 'WHATSAPP_LINK')
  ),
  CONSTRAINT voucher_delivery_resends_target_known CHECK (
    target_kind IN ('RECIPIENT', 'BUYER', 'CUSTOM')
  ),
  CONSTRAINT voucher_delivery_resends_status_known CHECK (
    status IN ('PENDING', 'SENT', 'FAILED', 'COPIED')
  ),
  CONSTRAINT voucher_delivery_resends_target_present CHECK (
    (channel = 'EMAIL' AND target_email IS NOT NULL AND char_length(target_email) BETWEEN 3 AND 254)
    OR (channel = 'WHATSAPP_LINK' AND target_phone IS NOT NULL AND char_length(target_phone) BETWEEN 6 AND 32)
  ),
  CONSTRAINT voucher_delivery_resends_error_length CHECK (
    error IS NULL OR char_length(error) <= 1000
  )
);

CREATE INDEX voucher_delivery_resends_voucher_created_idx
  ON public.voucher_delivery_resends (voucher_id, created_at DESC);

CREATE INDEX voucher_delivery_resends_order_idx
  ON public.voucher_delivery_resends (order_id);

ALTER TABLE public.voucher_delivery_resends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.voucher_delivery_resends FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.voucher_delivery_resends TO service_role;

-- Checks the voucher, applies the rate limit and writes a PENDING (email) or
-- COPIED (WhatsApp link) row. Returns jsonb with status:
--   ok, not_found, not_paid, redeemed, expired, rate_limited, cooldown.
CREATE FUNCTION public.voucher_resend_begin(
  p_voucher_id uuid,
  p_order_id uuid,
  p_channel text,
  p_target_kind text,
  p_target_email text,
  p_target_phone text,
  p_save_as_recipient boolean,
  p_requested_by uuid,
  p_requested_by_email text,
  p_requested_by_role text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_voucher public.vouchers;
  v_item_id uuid;
  v_recent integer;
  v_last timestamptz;
  v_retry integer;
  v_id uuid;
BEGIN
  IF p_channel NOT IN ('EMAIL', 'WHATSAPP_LINK')
    OR p_target_kind NOT IN ('RECIPIENT', 'BUYER', 'CUSTOM')
  THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  SELECT * INTO v_voucher FROM public.vouchers WHERE id = p_voucher_id;
  IF v_order.id IS NULL OR v_voucher.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT item.id INTO v_item_id
  FROM public.order_items AS item
  WHERE item.order_id = v_order.id
    AND item.voucher_id = v_voucher.id
  LIMIT 1;

  IF v_item_id IS NULL AND v_order.voucher_id IS DISTINCT FROM v_voucher.id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_order.payment_status <> 'COMPLETED' THEN
    RETURN jsonb_build_object('status', 'not_paid');
  END IF;
  IF v_voucher.is_redeemed THEN
    RETURN jsonb_build_object('status', 'redeemed');
  END IF;
  IF v_voucher.expiry_date <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF p_channel = 'EMAIL' THEN
    -- One resend decision per voucher at a time, so two clicks cannot both
    -- pass the limit.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('voucher_resend:' || v_voucher.id::text, 0)
    );

    SELECT count(*), max(resend.created_at)
    INTO v_recent, v_last
    FROM public.voucher_delivery_resends AS resend
    WHERE resend.voucher_id = v_voucher.id
      AND resend.channel = 'EMAIL'
      AND resend.created_at > now() - interval '1 hour';

    IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
      v_retry := GREATEST(1, ceil(extract(epoch FROM (v_last + interval '60 seconds' - now())))::integer);
      RETURN jsonb_build_object('status', 'cooldown', 'retry_after_seconds', v_retry);
    END IF;

    IF v_recent >= 3 THEN
      SELECT min(resend.created_at) INTO v_last
      FROM public.voucher_delivery_resends AS resend
      WHERE resend.voucher_id = v_voucher.id
        AND resend.channel = 'EMAIL'
        AND resend.created_at > now() - interval '1 hour';
      v_retry := GREATEST(1, ceil(extract(epoch FROM (v_last + interval '1 hour' - now())))::integer);
      RETURN jsonb_build_object('status', 'rate_limited', 'retry_after_seconds', v_retry);
    END IF;
  END IF;

  INSERT INTO public.voucher_delivery_resends (
    voucher_id,
    order_id,
    order_item_id,
    channel,
    target_kind,
    target_email,
    target_phone,
    save_as_recipient,
    previous_recipient_email,
    status,
    requested_by,
    requested_by_email,
    requested_by_role,
    finished_at
  )
  VALUES (
    v_voucher.id,
    v_order.id,
    v_item_id,
    p_channel,
    p_target_kind,
    CASE WHEN p_channel = 'EMAIL' THEN p_target_email END,
    CASE WHEN p_channel = 'WHATSAPP_LINK' THEN p_target_phone END,
    p_channel = 'EMAIL' AND p_target_kind = 'CUSTOM' AND COALESCE(p_save_as_recipient, false),
    v_voucher.recipient_email,
    CASE WHEN p_channel = 'EMAIL' THEN 'PENDING' ELSE 'COPIED' END,
    p_requested_by,
    p_requested_by_email,
    p_requested_by_role,
    CASE WHEN p_channel = 'WHATSAPP_LINK' THEN now() END
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'resend_id', v_id,
    'order_item_id', v_item_id
  );
END;
$$;

-- Marks a PENDING email row SENT or FAILED. On SENT with save_as_recipient,
-- updates vouchers.recipient_email and records the address it replaced. A
-- failed send leaves the voucher alone. Returns jsonb with status ok or not_found,
-- and recipient_email_updated.
CREATE FUNCTION public.voucher_resend_finish(
  p_resend_id uuid,
  p_sent boolean,
  p_provider_message_id text,
  p_error text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_row public.voucher_delivery_resends;
  v_updated boolean := false;
  v_replaced text;
BEGIN
  SELECT * INTO v_row
  FROM public.voucher_delivery_resends
  WHERE id = p_resend_id
    AND channel = 'EMAIL'
    AND status = 'PENDING'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_sent AND v_row.save_as_recipient THEN
    -- Read the address being replaced under the voucher lock: another resend
    -- may have changed it since this one began.
    SELECT voucher.recipient_email INTO v_replaced
    FROM public.vouchers AS voucher
    WHERE voucher.id = v_row.voucher_id
    FOR UPDATE;

    UPDATE public.vouchers
    SET recipient_email = v_row.target_email
    WHERE id = v_row.voucher_id;
    v_updated := true;
  END IF;

  UPDATE public.voucher_delivery_resends
  SET status = CASE WHEN p_sent THEN 'SENT' ELSE 'FAILED' END,
      provider_message_id = left(p_provider_message_id, 200),
      error = CASE WHEN p_sent THEN NULL ELSE left(COALESCE(p_error, 'Unknown error'), 1000) END,
      recipient_email_updated = v_updated,
      previous_recipient_email = CASE WHEN v_updated THEN v_replaced ELSE previous_recipient_email END,
      finished_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('status', 'ok', 'recipient_email_updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.voucher_resend_begin(uuid, uuid, text, text, text, text, boolean, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voucher_resend_begin(uuid, uuid, text, text, text, text, boolean, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.voucher_resend_finish(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voucher_resend_finish(uuid, boolean, text, text)
  TO service_role;

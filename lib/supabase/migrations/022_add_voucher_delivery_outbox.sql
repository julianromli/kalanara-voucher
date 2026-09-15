-- ============================================================================
-- Add durable, idempotent voucher delivery claims
-- Date: 2026-09-14
-- Purpose:
--   Make each voucher source/channel delivery uniquely claimable and allow
--   failed or abandoned claims to be retried without provider work in SQL.
--
-- Apply notes:
--   1. Apply this migration before deploying voucher fulfillment code that
--      calls public.claim_voucher_deliveries.
--   2. The narrow claim/finalization RPCs are SECURITY DEFINER functions with
--      empty search_path values and fully qualified objects.
--   3. Direct table access and RPC execution are revoked from public, anon,
--      and authenticated. Only service_role receives the required privileges.
--   4. After applying, verify anon/authenticated cannot read the table or call
--      the RPC, then concurrently call the RPC twice for one source/channel:
--      exactly one call must return that claim.
--   5. Sending occurs after the claim transaction commits. Provider success
--      followed by failure to persist SENT remains an unavoidable crash window
--      unless the provider also honors an idempotency key.
-- ============================================================================

CREATE TYPE public.voucher_delivery_channel AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE public.voucher_delivery_status AS ENUM
  ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE public.voucher_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  channel public.voucher_delivery_channel NOT NULL,
  status public.voucher_delivery_status NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  claimed_at timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE UNIQUE INDEX voucher_delivery_outbox_item_channel_unique
  ON public.voucher_delivery_outbox(order_item_id, channel)
  WHERE order_item_id IS NOT NULL;

CREATE UNIQUE INDEX voucher_delivery_outbox_legacy_order_channel_unique
  ON public.voucher_delivery_outbox(order_id, channel)
  WHERE order_item_id IS NULL;

CREATE INDEX voucher_delivery_outbox_retryable_idx
  ON public.voucher_delivery_outbox(next_attempt_at, created_at)
  WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');

ALTER TABLE public.voucher_delivery_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.voucher_delivery_outbox
  FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.voucher_delivery_outbox
  TO service_role;

REVOKE ALL ON TYPE public.voucher_delivery_channel
  FROM public, anon, authenticated;
REVOKE ALL ON TYPE public.voucher_delivery_status
  FROM public, anon, authenticated;
GRANT USAGE ON TYPE public.voucher_delivery_channel TO service_role;
GRANT USAGE ON TYPE public.voucher_delivery_status TO service_role;

CREATE FUNCTION public.claim_voucher_deliveries(
  p_order_id uuid,
  p_order_item_id uuid,
  p_voucher_id uuid,
  p_channels public.voucher_delivery_channel[]
)
RETURNS TABLE (
  id uuid,
  channel public.voucher_delivery_channel,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_order_id IS NULL
    OR p_voucher_id IS NULL
    OR p_channels IS NULL
    OR pg_catalog.cardinality(p_channels) = 0
    OR pg_catalog.array_position(p_channels, NULL) IS NOT NULL
  THEN
    RAISE EXCEPTION 'Voucher delivery claim arguments must be non-null and channels non-empty';
  END IF;

  INSERT INTO public.voucher_delivery_outbox (
    order_id,
    order_item_id,
    voucher_id,
    channel
  )
  SELECT
    p_order_id,
    p_order_item_id,
    p_voucher_id,
    requested.channel
  FROM pg_catalog.unnest(p_channels) AS requested(channel)
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  WITH claimable AS (
    SELECT outbox.id
    FROM public.voucher_delivery_outbox AS outbox
    WHERE outbox.order_id = p_order_id
      AND outbox.order_item_id IS NOT DISTINCT FROM p_order_item_id
      AND outbox.voucher_id = p_voucher_id
      AND outbox.channel = ANY(p_channels)
      AND (
        outbox.status = 'PENDING'
        OR (
          outbox.status = 'FAILED'
          AND outbox.next_attempt_at <= pg_catalog.now()
        )
        OR (
          outbox.status = 'PROCESSING'
          AND outbox.claimed_at < pg_catalog.now() - INTERVAL '5 minutes'
        )
      )
    ORDER BY outbox.created_at, outbox.id
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.voucher_delivery_outbox AS outbox
  SET
    status = 'PROCESSING',
    attempt_count = outbox.attempt_count + 1,
    claimed_at = pg_catalog.now(),
    claim_token = pg_catalog.gen_random_uuid(),
    updated_at = pg_catalog.now(),
    last_error = NULL
  FROM claimable
  WHERE outbox.id = claimable.id
  RETURNING outbox.id, outbox.channel, outbox.claim_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_voucher_deliveries(
  uuid,
  uuid,
  uuid,
  public.voucher_delivery_channel[]
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_voucher_deliveries(
  uuid,
  uuid,
  uuid,
  public.voucher_delivery_channel[]
) TO service_role;

CREATE FUNCTION public.finalize_voucher_delivery_sent(
  p_delivery_id uuid,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH finalized AS (
    UPDATE public.voucher_delivery_outbox AS outbox
    SET status = 'SENT',
        sent_at = pg_catalog.now(),
        claimed_at = NULL,
        claim_token = NULL,
        last_error = NULL,
        updated_at = pg_catalog.now()
    WHERE outbox.id = p_delivery_id
      AND outbox.status = 'PROCESSING'
      AND outbox.claim_token = p_claim_token
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM finalized);
$$;

CREATE FUNCTION public.finalize_voucher_delivery_failed(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_error text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH finalized AS (
    UPDATE public.voucher_delivery_outbox AS outbox
    SET status = 'FAILED',
        claimed_at = NULL,
        last_error = pg_catalog.left(p_error, 1000),
        next_attempt_at = pg_catalog.now() +
          pg_catalog.make_interval(mins =>
            LEAST(
              pg_catalog.power(
                2,
                LEAST(
                  GREATEST(outbox.attempt_count - 1, 0),
                  6
                )
              )::integer,
              60
            )
          ),
        claim_token = NULL,
        updated_at = pg_catalog.now()
    WHERE outbox.id = p_delivery_id
      AND outbox.status = 'PROCESSING'
      AND outbox.claim_token = p_claim_token
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM finalized);
$$;

REVOKE ALL ON FUNCTION public.finalize_voucher_delivery_sent(uuid, uuid)
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_voucher_delivery_failed(uuid, uuid, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_voucher_delivery_sent(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_voucher_delivery_failed(uuid, uuid, text)
  TO service_role;

-- ============================================================================
-- Add a durable terminal state for manual WhatsApp delivery handoff
-- Date: 2026-09-15
-- Purpose:
--   Record that a WhatsApp URL was generated without falsely claiming that an
--   automatic provider sent the message.
--
-- Apply notes:
--   1. Apply this migration before deploying fulfillment code that calls
--      public.finalize_voucher_delivery_handoff_required.
--   2. HANDOFF_REQUIRED is terminal for the automatic outbox worker. The claim
--      RPC and retry index intentionally continue to include only PENDING,
--      FAILED, and stale PROCESSING rows.
--   3. The finalizer requires the current immutable claim token and transitions
--      only PROCESSING rows after validating and durably storing the handoff
--      URL.
--   4. Direct RPC execution remains unavailable to public, anon, and
--      authenticated. Only service_role may execute the finalizer.
--   5. Verify a matching claim transitions once, a stale token returns false,
--      and HANDOFF_REQUIRED is not returned by claim_voucher_deliveries.
--   6. Dynamic SQL delays use of the new enum value until after this migration
--      commits, as PostgreSQL does not allow a newly-added enum value to be
--      used in the transaction that adds it.
-- ============================================================================

ALTER TYPE public.voucher_delivery_status
  ADD VALUE IF NOT EXISTS 'HANDOFF_REQUIRED';

ALTER TABLE public.voucher_delivery_outbox
  ADD COLUMN handoff_url text,
  ADD CONSTRAINT voucher_delivery_outbox_handoff_url_valid
    CHECK (
      handoff_url IS NULL
      OR (
        handoff_url = pg_catalog.btrim(handoff_url)
        AND handoff_url <> ''
        AND pg_catalog.char_length(handoff_url) <= 8192
      )
    );

CREATE FUNCTION public.finalize_voucher_delivery_handoff_required(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_handoff_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  finalized boolean;
BEGIN
  IF p_handoff_url IS NULL
    OR pg_catalog.btrim(p_handoff_url) = ''
    OR p_handoff_url <> pg_catalog.btrim(p_handoff_url)
    OR pg_catalog.char_length(p_handoff_url) > 8192
  THEN
    RAISE EXCEPTION 'Voucher delivery handoff URL must be nonblank and at most 8192 characters';
  END IF;

  EXECUTE $statement$
    WITH updated AS (
      UPDATE public.voucher_delivery_outbox AS outbox
      SET status = 'HANDOFF_REQUIRED',
          handoff_url = $3,
          claimed_at = NULL,
          claim_token = NULL,
          sent_at = NULL,
          last_error = NULL,
          updated_at = pg_catalog.now()
      WHERE outbox.id = $1
        AND outbox.status = 'PROCESSING'
        AND outbox.claim_token = $2
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM updated)
  $statement$
  INTO finalized
  USING p_delivery_id, p_claim_token, p_handoff_url;

  RETURN finalized;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_voucher_delivery_handoff_required(
  uuid,
  uuid,
  text
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_voucher_delivery_handoff_required(
  uuid,
  uuid,
  text
) TO service_role;

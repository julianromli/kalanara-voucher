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
--      only PROCESSING rows.
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

CREATE FUNCTION public.finalize_voucher_delivery_handoff_required(
  p_delivery_id uuid,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  finalized boolean;
BEGIN
  EXECUTE $statement$
    WITH updated AS (
      UPDATE public.voucher_delivery_outbox AS outbox
      SET status = 'HANDOFF_REQUIRED',
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
  USING p_delivery_id, p_claim_token;

  RETURN finalized;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_voucher_delivery_handoff_required(
  uuid,
  uuid
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_voucher_delivery_handoff_required(
  uuid,
  uuid
) TO service_role;

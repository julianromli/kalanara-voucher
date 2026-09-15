-- ============================================================================
-- Enforce atomic provider-driven payment state transitions
-- Date: 2026-09-14
-- Purpose:
--   Serialize payment observations per order, reject stale or forbidden state
--   changes, and persist gateway metadata only with an accepted observation.
--
-- Apply notes:
--   1. Apply this migration before deploying application code that calls
--      transition_order_payment_state.
--   2. Existing rows start at version 0 with no provider event timestamp. Their
--      first accepted provider observation establishes both values.
--   3. The function is SECURITY INVOKER and executable only by service_role.
--      Verify anon/authenticated calls are denied after applying the migration.
--   4. Genuine provider time is retained for stale-event comparison. Fallback
--      receipt time is tracked only in scalev_last_checked_at.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN payment_provider_event_at timestamptz,
  ADD COLUMN payment_state_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.payment_provider_event_at IS
  'Latest genuine provider event timestamp used for stale-event comparison; fallback receipt time is tracked only in scalev_last_checked_at.';
COMMENT ON COLUMN public.orders.payment_state_version IS
  'Monotonic version incremented for every accepted provider payment observation, including idempotent metadata refreshes.';

CREATE OR REPLACE FUNCTION public.transition_order_payment_state(
  p_order_id uuid,
  p_target_status public.payment_status,
  p_provider text,
  p_provider_event_at timestamptz,
  p_provider_event_at_is_fallback boolean DEFAULT false,
  p_expected_version bigint DEFAULT NULL,
  p_transaction_id text DEFAULT NULL,
  p_payment_type text DEFAULT NULL,
  p_transaction_time timestamptz DEFAULT NULL,
  p_payment_link text DEFAULT NULL,
  p_scalev_order_pk bigint DEFAULT NULL,
  p_scalev_order_id text DEFAULT NULL,
  p_scalev_pg_reference_id text DEFAULT NULL,
  p_scalev_payment_method text DEFAULT NULL,
  p_scalev_sub_payment_method text DEFAULT NULL,
  p_scalev_store_unique_id text DEFAULT NULL,
  p_scalev_raw_status text DEFAULT NULL,
  p_scalev_raw_payment_status text DEFAULT NULL,
  p_scalev_last_checked_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  accepted boolean,
  changed boolean,
  reason text,
  previous_status public.payment_status,
  current_status public.payment_status,
  state_version bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status public.payment_status;
  v_event_at timestamptz;
  v_version bigint;
  v_changed boolean;
BEGIN
  SELECT
    o.payment_status,
    o.payment_provider_event_at,
    o.payment_state_version
  INTO v_status, v_event_at, v_version
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      false,
      'not_found',
      NULL::public.payment_status,
      NULL::public.payment_status,
      NULL::bigint;
    RETURN;
  END IF;

  IF p_provider_event_at IS NULL THEN
    RETURN QUERY SELECT
      false,
      false,
      'missing_provider_event_at',
      v_status,
      v_status,
      v_version;
    RETURN;
  END IF;

  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version THEN
    RETURN QUERY SELECT
      false,
      false,
      'version_conflict',
      v_status,
      v_status,
      v_version;
    RETURN;
  END IF;

  IF NOT p_provider_event_at_is_fallback
    AND v_event_at IS NOT NULL
    AND p_provider_event_at < v_event_at
  THEN
    RETURN QUERY SELECT
      false,
      false,
      'stale_provider_event',
      v_status,
      v_status,
      v_version;
    RETURN;
  END IF;

  IF NOT (
    p_target_status = v_status
    OR (
      v_status = 'PENDING'
      AND p_target_status IN ('COMPLETED', 'FAILED')
    )
    OR (
      v_status = 'COMPLETED'
      AND p_target_status = 'REFUNDED'
    )
  ) THEN
    RETURN QUERY SELECT
      false,
      false,
      'transition_rejected',
      v_status,
      v_status,
      v_version;
    RETURN;
  END IF;

  v_changed := p_target_status <> v_status;

  UPDATE public.orders AS o
  SET
    payment_status = p_target_status,
    payment_provider = COALESCE(p_provider, o.payment_provider),
    payment_provider_event_at = CASE
      WHEN p_provider_event_at_is_fallback
        THEN o.payment_provider_event_at
      ELSE p_provider_event_at
    END,
    payment_state_version = o.payment_state_version + 1,
    payment_transaction_id =
      COALESCE(p_transaction_id, o.payment_transaction_id),
    payment_type = COALESCE(p_payment_type, o.payment_type),
    payment_transaction_time = CASE
      WHEN p_provider_event_at_is_fallback
        THEN o.payment_transaction_time
      ELSE COALESCE(p_transaction_time, o.payment_transaction_time)
    END,
    payment_link = COALESCE(p_payment_link, o.payment_link),
    scalev_order_pk = COALESCE(p_scalev_order_pk, o.scalev_order_pk),
    scalev_order_id = COALESCE(p_scalev_order_id, o.scalev_order_id),
    scalev_pg_reference_id =
      COALESCE(p_scalev_pg_reference_id, o.scalev_pg_reference_id),
    scalev_payment_method =
      COALESCE(p_scalev_payment_method, o.scalev_payment_method),
    scalev_sub_payment_method =
      COALESCE(p_scalev_sub_payment_method, o.scalev_sub_payment_method),
    scalev_store_unique_id =
      COALESCE(p_scalev_store_unique_id, o.scalev_store_unique_id),
    scalev_raw_status =
      COALESCE(p_scalev_raw_status, o.scalev_raw_status),
    scalev_raw_payment_status =
      COALESCE(p_scalev_raw_payment_status, o.scalev_raw_payment_status),
    scalev_last_checked_at =
      COALESCE(p_scalev_last_checked_at, o.scalev_last_checked_at)
  WHERE o.id = p_order_id
  RETURNING o.payment_state_version INTO v_version;

  RETURN QUERY SELECT
    true,
    v_changed,
    CASE WHEN v_changed THEN 'applied' ELSE 'idempotent' END,
    v_status,
    p_target_status,
    v_version;
END;
$$;

-- Migration 003 briefly allowed anonymous clients to mutate every order.
-- All legitimate runtime writes use the service-role server client.
DROP POLICY IF EXISTS "orders_anon_update" ON public.orders;

REVOKE ALL ON FUNCTION public.transition_order_payment_state(
  uuid,
  public.payment_status,
  text,
  timestamptz,
  boolean,
  bigint,
  text,
  text,
  timestamptz,
  text,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.transition_order_payment_state(
  uuid,
  public.payment_status,
  text,
  timestamptz,
  boolean,
  bigint,
  text,
  text,
  timestamptz,
  text,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
) TO service_role;

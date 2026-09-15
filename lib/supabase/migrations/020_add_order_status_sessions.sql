-- ============================================================================
-- Add short-lived order status sessions
-- Date: 2026-09-14
-- Purpose:
--   Replace browser-visible durable order capabilities with a 30-minute,
--   server-mediated session. Only a SHA-256 token hash is stored.
--
-- Apply note:
--   Apply this migration before deploying the matching application code.
--   The application creates a status session immediately after payment setup;
--   checkout fails closed if this table is unavailable.
-- ============================================================================

CREATE TABLE public.order_status_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL
    REFERENCES public.orders(id)
    ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Supports per-order cleanup/audit and verifies the foreign-key side is
-- indexed. Expiry is second so order-scoped expiry queries can use the index.
CREATE INDEX order_status_sessions_order_expiry_idx
  ON public.order_status_sessions (order_id, expires_at);

-- Supports independently scheduled global expired-session cleanup without
-- adding unrelated table-wide work to checkout creation.
CREATE INDEX order_status_sessions_expiry_idx
  ON public.order_status_sessions (expires_at);

ALTER TABLE public.order_status_sessions ENABLE ROW LEVEL SECURITY;

-- Deliberately add no anon/authenticated policy. Runtime access is restricted
-- to the server-only service-role client, which bypasses RLS.
REVOKE ALL ON TABLE public.order_status_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.order_status_sessions TO service_role;

COMMENT ON TABLE public.order_status_sessions IS
  'Short-lived server-only sessions for public order status access; raw tokens are never stored.';
COMMENT ON COLUMN public.order_status_sessions.token_hash IS
  'SHA-256 hash of the raw token held only in a per-session HttpOnly cookie.';

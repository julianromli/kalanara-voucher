CREATE TABLE IF NOT EXISTS public.scalev_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'scalev',
  event_type text NOT NULL,
  external_event_hash text NOT NULL UNIQUE,
  signature text,
  payload jsonb,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  scalev_order_pk bigint,
  scalev_order_id text,
  scalev_pg_reference_id text,
  payment_status text,
  processing_status text NOT NULL DEFAULT 'received',
  processing_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_scalev_webhook_events_created_at
  ON public.scalev_webhook_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scalev_webhook_events_processing_status
  ON public.scalev_webhook_events (processing_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scalev_webhook_events_order_id
  ON public.scalev_webhook_events (order_id);

CREATE INDEX IF NOT EXISTS idx_scalev_webhook_events_scalev_refs
  ON public.scalev_webhook_events (scalev_order_pk, scalev_order_id, scalev_pg_reference_id);

ALTER TABLE public.scalev_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scalev_webhook_events_select" ON public.scalev_webhook_events;
DROP POLICY IF EXISTS "scalev_webhook_events_insert" ON public.scalev_webhook_events;
DROP POLICY IF EXISTS "scalev_webhook_events_update" ON public.scalev_webhook_events;
DROP POLICY IF EXISTS "scalev_webhook_events_delete" ON public.scalev_webhook_events;

CREATE POLICY "scalev_webhook_events_select" ON public.scalev_webhook_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "scalev_webhook_events_insert" ON public.scalev_webhook_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "scalev_webhook_events_update" ON public.scalev_webhook_events
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "scalev_webhook_events_delete" ON public.scalev_webhook_events
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

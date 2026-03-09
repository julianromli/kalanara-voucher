-- ============================================================================
-- Scalev Payment Integration Migration
-- Version: 5.0.0
-- Description: Additive columns and indexes for Scalev catalog/payment sync
-- ============================================================================

-- Services: store 1:1 Scalev product/variant mapping
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS scalev_product_id BIGINT,
  ADD COLUMN IF NOT EXISTS scalev_variant_id BIGINT,
  ADD COLUMN IF NOT EXISTS scalev_variant_unique_id TEXT,
  ADD COLUMN IF NOT EXISTS scalev_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS scalev_last_synced_at TIMESTAMPTZ;

-- Orders: store gateway-specific reconciliation fields while preserving generic fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'scalev',
  ADD COLUMN IF NOT EXISTS scalev_order_pk BIGINT,
  ADD COLUMN IF NOT EXISTS scalev_order_id TEXT,
  ADD COLUMN IF NOT EXISTS scalev_pg_reference_id TEXT,
  ADD COLUMN IF NOT EXISTS scalev_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS scalev_sub_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS scalev_store_unique_id TEXT,
  ADD COLUMN IF NOT EXISTS scalev_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scalev_raw_status TEXT,
  ADD COLUMN IF NOT EXISTS scalev_raw_payment_status TEXT;

-- Historical compatibility: existing Mayar rows should remain identifiable
UPDATE orders
SET payment_provider = 'mayar'
WHERE payment_provider = 'scalev'
  AND (payment_link IS NOT NULL OR payment_transaction_id IS NOT NULL);

-- Partial indexes for gateway lookups and catalog sync
CREATE INDEX IF NOT EXISTS idx_services_scalev_variant_unique_id
  ON services (scalev_variant_unique_id)
  WHERE scalev_variant_unique_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider_order_id
  ON orders (payment_provider, payment_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_scalev_order_pk
  ON orders (scalev_order_pk)
  WHERE scalev_order_pk IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_scalev_pg_reference_id
  ON orders (scalev_pg_reference_id)
  WHERE scalev_pg_reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id
  ON orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

COMMENT ON COLUMN services.scalev_product_id IS 'Scalev product primary key for this service';
COMMENT ON COLUMN services.scalev_variant_id IS 'Scalev variant primary key for this service';
COMMENT ON COLUMN services.scalev_variant_unique_id IS 'Scalev variant unique_id used for order creation';
COMMENT ON COLUMN services.scalev_sync_status IS 'Sync state for catalog mirroring to Scalev';
COMMENT ON COLUMN services.scalev_last_synced_at IS 'Last successful sync time to Scalev';

COMMENT ON COLUMN orders.payment_provider IS 'Payment gateway provider used for the order';
COMMENT ON COLUMN orders.scalev_order_pk IS 'Scalev order primary key';
COMMENT ON COLUMN orders.scalev_order_id IS 'Scalev external order_id string';
COMMENT ON COLUMN orders.scalev_pg_reference_id IS 'Scalev payment gateway reference identifier';
COMMENT ON COLUMN orders.scalev_payment_method IS 'Final Scalev payment method code';
COMMENT ON COLUMN orders.scalev_sub_payment_method IS 'Final Scalev sub payment method/bank code';
COMMENT ON COLUMN orders.scalev_store_unique_id IS 'Scalev store unique_id used to create the order';
COMMENT ON COLUMN orders.scalev_last_checked_at IS 'Last server-side reconciliation timestamp';
COMMENT ON COLUMN orders.scalev_raw_status IS 'Raw Scalev order status';
COMMENT ON COLUMN orders.scalev_raw_payment_status IS 'Raw Scalev payment status';

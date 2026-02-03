-- lib/supabase/migrations/004_mayar_migration.sql

-- =============================================
-- Migration: Rename Midtrans columns to generic payment columns
-- For: Mayar.id payment gateway migration
-- Date: 2026-02-01
-- =============================================

-- Rename columns (preserves existing data)
ALTER TABLE orders RENAME COLUMN midtrans_order_id TO payment_order_id;
ALTER TABLE orders RENAME COLUMN midtrans_transaction_id TO payment_transaction_id;
ALTER TABLE orders RENAME COLUMN midtrans_payment_type TO payment_type;
ALTER TABLE orders RENAME COLUMN midtrans_transaction_time TO payment_transaction_time;

-- Add new column for payment link URL
ALTER TABLE orders ADD COLUMN payment_link TEXT;

-- Update column comments
COMMENT ON COLUMN orders.payment_order_id IS 'Unique order ID sent to payment gateway (format: KSP-{timestamp}-{random})';
COMMENT ON COLUMN orders.payment_transaction_id IS 'Transaction ID returned by payment gateway';
COMMENT ON COLUMN orders.payment_type IS 'Payment method used (e.g., qris, bank_transfer, e_wallet)';
COMMENT ON COLUMN orders.payment_transaction_time IS 'Timestamp of payment from gateway';
COMMENT ON COLUMN orders.payment_link IS 'Payment URL for customer redirect (Mayar payment link)';

-- Create partial index for webhook lookup (if not exists)
CREATE INDEX IF NOT EXISTS orders_payment_order_id_idx ON orders (payment_order_id)
  WHERE payment_order_id IS NOT NULL;

-- Create partial index for transaction ID lookup (fallback webhook processing)
CREATE INDEX IF NOT EXISTS orders_payment_transaction_id_idx ON orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

-- ============================================================================
-- Midtrans Payment Integration Migration
-- Version: 3.0.0
-- Description: Add Midtrans-specific columns to orders table
-- Requirements: 7.1, 7.2
-- ============================================================================

-- ============================================================================
-- MODIFY ORDERS TABLE FOR MIDTRANS
-- ============================================================================

-- Make voucher_id nullable (voucher created after payment success)
ALTER TABLE orders ALTER COLUMN voucher_id DROP NOT NULL;

-- Add Midtrans-specific columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS midtrans_order_id VARCHAR(255) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS midtrans_transaction_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS midtrans_payment_type VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS midtrans_transaction_time TIMESTAMPTZ;

-- Add columns for recipient info (needed for voucher creation after payment)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_message TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS send_to VARCHAR(20);

-- Create index for webhook lookups by midtrans_order_id
CREATE INDEX IF NOT EXISTS idx_orders_midtrans_order_id ON orders(midtrans_order_id);

-- Create index for midtrans_transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_orders_midtrans_transaction_id ON orders(midtrans_transaction_id);

-- Add comments for documentation
COMMENT ON COLUMN orders.midtrans_order_id IS 'Unique order ID sent to Midtrans (format: KSP-{timestamp}-{random})';
COMMENT ON COLUMN orders.midtrans_transaction_id IS 'Transaction ID returned by Midtrans after payment';
COMMENT ON COLUMN orders.midtrans_payment_type IS 'Payment method used (e.g., credit_card, bank_transfer, gopay)';
COMMENT ON COLUMN orders.midtrans_transaction_time IS 'Timestamp of the transaction from Midtrans';
COMMENT ON COLUMN orders.service_id IS 'Service being purchased (for voucher creation after payment)';
COMMENT ON COLUMN orders.recipient_name IS 'Voucher recipient name';
COMMENT ON COLUMN orders.recipient_email IS 'Voucher recipient email';
COMMENT ON COLUMN orders.recipient_phone IS 'Voucher recipient phone for WhatsApp delivery';
COMMENT ON COLUMN orders.sender_message IS 'Personal message from purchaser to recipient';
COMMENT ON COLUMN orders.delivery_method IS 'Voucher delivery method: EMAIL, WHATSAPP, or BOTH';
COMMENT ON COLUMN orders.send_to IS 'Who receives the voucher: PURCHASER or RECIPIENT';

-- ============================================================================
-- UPDATE RLS POLICIES FOR WEBHOOK ACCESS
-- ============================================================================

-- Allow anonymous updates to orders (for webhook processing)
-- Note: Webhook handler uses service role key, but this is a fallback
CREATE POLICY IF NOT EXISTS "orders_anon_update" ON orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

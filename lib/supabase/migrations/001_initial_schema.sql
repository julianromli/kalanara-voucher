-- ============================================================================
-- Kalanara Spa Voucher Database Schema
-- Version: 1.0.0
-- Description: Complete PostgreSQL schema for Supabase deployment
-- ============================================================================

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Service category enum
CREATE TYPE service_category AS ENUM (
  'MASSAGE',
  'FACIAL',
  'BODY_TREATMENT',
  'PACKAGE'
);

-- Payment method enum
CREATE TYPE payment_method AS ENUM (
  'CREDIT_CARD',
  'BANK_TRANSFER',
  'E_WALLET'
);

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

-- Admin role enum
CREATE TYPE admin_role AS ENUM (
  'SUPER_ADMIN',
  'MANAGER',
  'STAFF'
);

-- ============================================================================
-- SERVICES TABLE
-- ============================================================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL CHECK (duration > 0), -- in minutes
  price INTEGER NOT NULL CHECK (price >= 0), -- in IDR (no cents, stored as integer)
  category service_category NOT NULL,
  image_url TEXT, -- Supabase Storage URL
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on category for filtering
CREATE INDEX idx_services_category ON services(category);

-- Create index on is_active for filtering active services
CREATE INDEX idx_services_is_active ON services(is_active);

-- Add comment to table
COMMENT ON TABLE services IS 'Spa services offered by Kalanara Spa';
COMMENT ON COLUMN services.price IS 'Price in Indonesian Rupiah (IDR)';
COMMENT ON COLUMN services.duration IS 'Service duration in minutes';

-- ============================================================================
-- VOUCHERS TABLE
-- ============================================================================

CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- format: KSP-YYYY-XXXXXXXX
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_message TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMPTZ,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on voucher code (already unique constraint, but explicit index for lookups)
CREATE INDEX idx_vouchers_code ON vouchers(code);

-- Create index on service_id for joins
CREATE INDEX idx_vouchers_service_id ON vouchers(service_id);

-- Create index on is_redeemed for filtering
CREATE INDEX idx_vouchers_is_redeemed ON vouchers(is_redeemed);

-- Create index on expiry_date for filtering expired vouchers
CREATE INDEX idx_vouchers_expiry_date ON vouchers(expiry_date);

-- Create index on recipient_email for lookups
CREATE INDEX idx_vouchers_recipient_email ON vouchers(recipient_email);

-- Add check constraint for voucher code format
ALTER TABLE vouchers ADD CONSTRAINT chk_voucher_code_format 
  CHECK (code ~ '^KSP-[0-9]{4}-[A-Z0-9]{8}$');

-- Add check constraint for redeemed_at
ALTER TABLE vouchers ADD CONSTRAINT chk_redeemed_at_consistency 
  CHECK ((is_redeemed = false AND redeemed_at IS NULL) OR (is_redeemed = true AND redeemed_at IS NOT NULL));

COMMENT ON TABLE vouchers IS 'Gift vouchers for spa services';
COMMENT ON COLUMN vouchers.code IS 'Unique voucher code in format KSP-YYYY-XXXXXXXX';
COMMENT ON COLUMN vouchers.amount IS 'Voucher amount in Indonesian Rupiah (IDR)';

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on voucher_id for joins
CREATE INDEX idx_orders_voucher_id ON orders(voucher_id);

-- Create index on payment_status for filtering
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- Create index on customer_email for lookups
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Create index on created_at for time-based queries
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

COMMENT ON TABLE orders IS 'Purchase orders for vouchers';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount in Indonesian Rupiah (IDR)';

-- ============================================================================
-- REVIEWS TABLE
-- ============================================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on voucher_id for joins
CREATE INDEX idx_reviews_voucher_id ON reviews(voucher_id);

-- Create index on rating for filtering
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Ensure one review per voucher
CREATE UNIQUE INDEX idx_reviews_unique_voucher ON reviews(voucher_id);

COMMENT ON TABLE reviews IS 'Customer reviews for redeemed vouchers';
COMMENT ON COLUMN reviews.rating IS 'Rating from 1 (lowest) to 5 (highest)';

-- ============================================================================
-- ADMINS TABLE
-- ============================================================================

CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for lookups
CREATE INDEX idx_admins_email ON admins(email);

-- Create index on role for filtering
CREATE INDEX idx_admins_role ON admins(role);

COMMENT ON TABLE admins IS 'Admin users linked to Supabase Auth';

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to services table
CREATE TRIGGER trigger_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICES POLICIES
-- Public can read active services, admins can do everything
-- ============================================================================

-- Public read access for active services
CREATE POLICY "services_public_read" ON services
  FOR SELECT
  USING (is_active = true);

-- Admin full access to services
CREATE POLICY "services_admin_all" ON services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- ============================================================================
-- VOUCHERS POLICIES
-- Public can read by code, admins have full access
-- ============================================================================

-- Public read access by voucher code (used for verification)
CREATE POLICY "vouchers_public_read_by_code" ON vouchers
  FOR SELECT
  USING (true); -- Allow all reads, actual filtering happens in app

-- Admin full access to vouchers
CREATE POLICY "vouchers_admin_all" ON vouchers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Anonymous users can insert vouchers (for purchase flow)
CREATE POLICY "vouchers_anon_insert" ON vouchers
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- ORDERS POLICIES
-- Only admins can access orders (sensitive financial data)
-- ============================================================================

-- Admin full access to orders
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- Anonymous users can insert orders (for purchase flow)
CREATE POLICY "orders_anon_insert" ON orders
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- REVIEWS POLICIES
-- Public can read reviews, anyone can insert (customers), admins have full access
-- ============================================================================

-- Public read access to reviews
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT
  USING (true);

-- Public can insert reviews (customers submitting feedback)
CREATE POLICY "reviews_public_insert" ON reviews
  FOR INSERT
  WITH CHECK (true);

-- Admin full access to reviews (including delete for moderation)
CREATE POLICY "reviews_admin_all" ON reviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

-- ============================================================================
-- ADMINS POLICIES
-- Only authenticated admins can access admin table
-- ============================================================================

-- Admins can read their own record
CREATE POLICY "admins_read_own" ON admins
  FOR SELECT
  USING (id = auth.uid());

-- Super admins can see all admins
CREATE POLICY "admins_super_admin_read" ON admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.role = 'SUPER_ADMIN'
    )
  );

-- Super admins can manage all admins
CREATE POLICY "admins_super_admin_all" ON admins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid() AND admins.role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate voucher code
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN 'KSP-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: Initial Services
-- ============================================================================

INSERT INTO services (id, name, description, duration, price, category, image_url, is_active) VALUES
(
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Balinese Traditional Massage',
  'A centuries-old healing technique combining gentle stretches, acupressure, and aromatherapy. This full-body treatment improves blood circulation, relieves muscle tension, and promotes deep relaxation.',
  90,
  850000,
  'MASSAGE',
  '/images/services/balinese-massage.jpg',
  true
),
(
  'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
  'Hot Stone Therapy',
  'Smooth, heated volcanic stones are placed on key points of your body while our therapists use warm stones to massage your muscles. The penetrating heat melts away tension and stress.',
  75,
  950000,
  'MASSAGE',
  '/images/services/hot-stone.jpg',
  true
),
(
  'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',
  'Deep Tissue Massage',
  'Focused pressure techniques target chronic muscle tension and knots in deeper layers of muscle tissue. Ideal for athletes and those with persistent muscle pain.',
  60,
  750000,
  'MASSAGE',
  '/images/services/deep-tissue.jpg',
  true
),
(
  'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
  'Luminous Glow Facial',
  'A luxurious facial treatment using organic ingredients to cleanse, exfoliate, and hydrate. Includes a facial massage, mask, and LED light therapy for radiant, glowing skin.',
  60,
  650000,
  'FACIAL',
  '/images/services/facial-glow.jpg',
  true
),
(
  'e5f6a7b8-c9d0-8e9f-2a3b-4c5d6e7f8a9b',
  'Anti-Aging Renewal Facial',
  'Advanced skincare treatment featuring collagen-boosting serums, microcurrent therapy, and jade roller massage. Reduces fine lines and restores youthful vitality.',
  90,
  1200000,
  'FACIAL',
  '/images/services/anti-aging.jpg',
  true
),
(
  'f6a7b8c9-d0e1-9f0a-3b4c-5d6e7f8a9b0c',
  'Boreh Body Scrub & Wrap',
  'Traditional Balinese treatment using a warming blend of spices, rice, and herbs. This detoxifying scrub is followed by a nourishing body wrap to soften and rejuvenate skin.',
  120,
  800000,
  'BODY_TREATMENT',
  '/images/services/boreh-scrub.jpg',
  true
),
(
  'a7b8c9d0-e1f2-0a1b-4c5d-6e7f8a9b0c1d',
  'Coconut Milk Bath Ritual',
  'Immerse yourself in a luxurious bath of fresh coconut milk, flower petals, and essential oils. This royal treatment softens skin and calms the mind.',
  45,
  550000,
  'BODY_TREATMENT',
  '/images/services/milk-bath.jpg',
  true
),
(
  'b8c9d0e1-f2a3-1b2c-5d6e-7f8a9b0c1d2e',
  'Harmony Half-Day Retreat',
  'Complete spa journey including Balinese massage, facial treatment, body scrub, and flower bath. Includes healthy lunch and herbal refreshments.',
  240,
  2500000,
  'PACKAGE',
  '/images/services/half-day-retreat.jpg',
  true
),
(
  'c9d0e1f2-a3b4-2c3d-6e7f-8a9b0c1d2e3f',
  'Couples Bliss Package',
  'Share the experience of relaxation with your loved one. Includes side-by-side massages, facial treatments, and a private flower bath with champagne.',
  180,
  3800000,
  'PACKAGE',
  '/images/services/couples-package.jpg',
  true
),
(
  'd0e1f2a3-b4c5-3d4e-7f8a-9b0c1d2e3f4a',
  'Ultimate Wellness Day',
  'The complete Kalanara experience. Full day of treatments including massage, facial, body scrub, bath ritual, manicure, pedicure, and gourmet lunch.',
  480,
  5500000,
  'PACKAGE',
  '/images/services/full-day-retreat.jpg',
  true
);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

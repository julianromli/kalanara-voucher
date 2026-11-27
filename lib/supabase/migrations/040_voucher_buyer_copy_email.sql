-- ============================================================================
-- Buyer copy email: a delivery channel for the buyer's copy of a gift voucher
-- Date: 2026-11-27
--
-- Apply notes:
--   1. Apply this file before merging the buyer copy delivery code.
--   2. Run it on its own. PostgreSQL does not allow a new enum value to be
--      used in the transaction that adds it, and nothing here uses it.
--   3. Do not apply from the app or CI. A person must run this on the
--      live project after review.
--
-- Rules:
--   - When a voucher is for someone else, the buyer gets a copy by email.
--     No copy when the buyer and recipient emails are the same.
--   - The copy is its own outbox row (order_item_id, 'EMAIL_BUYER_COPY'), so
--     the existing unique index makes it send once per voucher and lets a
--     failed copy retry like any other channel.
--   - Only new deliveries get a copy. App code adds the channel only when the
--     voucher has no EMAIL row yet, or already has a copy row to retry, so
--     replayed webhooks for old orders send nothing new.
--   - No table, policy or grant changes. voucher_delivery_outbox and its
--     functions keep the RLS and service_role-only grants from 022 and 026.
-- ============================================================================

ALTER TYPE public.voucher_delivery_channel
  ADD VALUE IF NOT EXISTS 'EMAIL_BUYER_COPY';

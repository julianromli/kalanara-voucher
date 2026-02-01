# Mayar.id Payment Gateway Migration Design

**Date:** 2026-02-01
**Status:** Approved
**Author:** AI Assistant

## Overview

Migrasi payment gateway dari Midtrans ke Mayar.id untuk Kalanara Spa Voucher Platform.

### Goals
- Full replacement Midtrans dengan Mayar.id
- Simplifikasi payment flow (redirect instead of popup)
- Reduce client-side complexity (no Snap.js)
- Lower transaction fees

### Non-Goals
- Dual payment gateway support
- Migration of historical transaction data

## Architecture

### Payment Flow Comparison

**Before (Midtrans Snap):**
1. User submit form → API create pending order + get Snap token
2. Frontend load Snap.js → Show popup modal
3. User pay in popup → Snap callback (success/pending/error)
4. Webhook update order → Create voucher

**After (Mayar Redirect):**
1. User submit form → API create pending order + call Mayar `/payment/create`
2. API return `{ paymentLink, orderId }` → Frontend redirect to `paymentLink`
3. User pay at Mayar page → Mayar redirect back to `redirectUrl`
4. Webhook (`payment.received`) → Update order → Create voucher
5. Redirect URL shows success page (with order lookup)

### Key Changes

| Component | Before (Midtrans) | After (Mayar) |
|-----------|-------------------|---------------|
| Payment Flow | Snap.js popup | Redirect to Mayar URL |
| API Endpoint | `/api/midtrans/create-transaction` | `/api/mayar/create-payment` |
| Webhook | `/api/midtrans/notification` | `/api/mayar/webhook` |
| Auth | Signature verification | Basic validation |
| DB Columns | `midtrans_*` | `payment_*` |

## Database Schema

### Migration SQL

```sql
-- =============================================
-- Migration: Rename Midtrans columns to generic payment columns
-- Follows: Supabase Postgres Best Practices 4.5
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

-- Index for webhook lookup (partial index for non-null values)
CREATE INDEX IF NOT EXISTS orders_payment_order_id_idx ON orders (payment_order_id)
  WHERE payment_order_id IS NOT NULL;
```

### Backward Compatibility
- Existing orders dengan data Midtrans tetap bisa dibaca
- Kolom di-rename, data preserved
- Format `payment_order_id` tetap `KSP-{timestamp}-{random}`

## API Design

### File Structure

```
lib/
├── mayar/
│   ├── config.ts          # Mayar config (API key, base URL)
│   ├── types.ts           # TypeScript types for Mayar API
│   ├── client.ts          # Mayar API client
│   └── webhook.ts         # Webhook payload validation

app/api/
├── mayar/
│   ├── create-payment/
│   │   └── route.ts       # POST: Create payment & redirect URL
│   └── webhook/
│       └── route.ts       # POST: Handle payment.received event
```

### TypeScript Types

```typescript
// lib/mayar/types.ts

// Request untuk create payment
export interface MayarCreatePaymentRequest {
  name: string;           // Customer name
  email: string;          // Customer email
  amount: number;         // Amount in IDR
  mobile: string;         // Phone number
  redirectUrl: string;    // Redirect after payment
  description: string;    // Order description
  expiredAt: string;      // ISO 8601 datetime
}

// Response dari Mayar
export interface MayarCreatePaymentResponse {
  statusCode: number;
  messages: string;
  data: {
    id: string;             // Payment ID
    transactionId: string;  // Transaction ID
    link: string;           // Payment URL for redirect
  };
}

// Webhook payload
export interface MayarWebhookPayload {
  event: 'payment.received' | 'payment.reminder';
  data: {
    id: string;
    transactionId: string;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    transactionStatus: 'paid' | 'created' | 'expired';
    customerName: string;
    customerEmail: string;
    customerMobile: string;
    amount: number;
    paymentMethod: string | null;
    productName: string;
  };
}
```

### Environment Variables

```env
# .env.local
MAYAR_API_KEY=              # API key from web.mayar.id/api-keys
MAYAR_IS_PRODUCTION=false   # true for production

# Base URLs (derived from MAYAR_IS_PRODUCTION)
# Production: https://api.mayar.id/hl/v1
# Sandbox: https://api.mayar.club/hl/v1
```

## Checkout Flow

### Updated Checkout Page

```typescript
// app/checkout/[id]/page.tsx

// REMOVED: useMidtransSnap hook
// REMOVED: Snap.js script loading

const onSubmit = async (data: CheckoutForm) => {
  setIsProcessing(true);
  
  const response = await fetch("/api/mayar/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: service.id,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      senderMessage: data.senderMessage,
      deliveryMethod: data.deliveryMethod,
      sendTo: data.sendTo,
    }),
  });

  const result = await response.json();
  
  if (result.success && result.paymentLink) {
    // Redirect ke halaman Mayar
    window.location.href = result.paymentLink;
  } else {
    showToast(result.error || "Gagal membuat pembayaran", "error");
    setIsProcessing(false);
  }
};
```

### Success Page
- URL: `/checkout/success?order_id=xxx`
- Lookup order by `payment_order_id`
- Show voucher details if payment completed
- Show "menunggu konfirmasi" if still pending

## Webhook Handling

### Handler Logic

```typescript
// app/api/mayar/webhook/route.ts

export async function POST(request: NextRequest) {
  const body = await request.json() as MayarWebhookPayload;
  
  // 1. Validate event type
  if (body.event !== 'payment.received') {
    return NextResponse.json({ status: 'ok', message: 'Ignored event' });
  }
  
  // 2. Validate payment status
  if (body.data.status !== 'SUCCESS' || body.data.transactionStatus !== 'paid') {
    return NextResponse.json({ status: 'ok', message: 'Not paid' });
  }
  
  // 3. Extract order ID from description
  const orderId = extractOrderIdFromPayload(body.data);
  
  // 4. Lookup order
  const order = await getOrderByPaymentOrderId(orderId);
  if (!order) {
    return NextResponse.json({ status: 'ok', message: 'Order not found' });
  }
  
  // 5. Idempotency check
  if (order.payment_status === 'COMPLETED') {
    return NextResponse.json({ status: 'ok', message: 'Already processed' });
  }
  
  // 6. Update order & create voucher
  await updateOrderPaymentStatus(order.id, 'COMPLETED', {
    transaction_id: body.data.transactionId,
    payment_type: body.data.paymentMethod || 'unknown',
    transaction_time: new Date().toISOString(),
  });
  
  await createVoucherOnPaymentSuccess(order);
  
  return NextResponse.json({ status: 'ok', message: 'Processed' });
}
```

### Security
- Idempotency check (prevent duplicate processing)
- Status validation (only process SUCCESS + paid)
- Always return 200 OK (prevent webhook retry spam)

## File Changes

### Files to DELETE

```
lib/midtrans/                    # Entire directory
├── config.ts
├── signature.ts
├── types.ts
├── voucher-service.ts           # KEEP, move to lib/payment/
└── __tests__/

app/api/midtrans/                # Entire directory
├── create-transaction/route.ts
└── notification/route.ts

hooks/useMidtransSnap.ts         # Snap.js hook

docs/midtrans-setup.md           # Replace with mayar-setup.md
```

### Files to MODIFY

```
app/checkout/[id]/page.tsx       # Remove Snap, add redirect flow
lib/actions/orders.ts            # Rename function params (midtrans → payment)
lib/database.types.ts            # Regenerate after migration
.env.local                       # Replace Midtrans keys with Mayar
.env.example                     # Update example
AGENTS.md                        # Update env var documentation
```

### Files to CREATE

```
lib/mayar/
├── config.ts
├── types.ts
├── client.ts

app/api/mayar/
├── create-payment/route.ts
└── webhook/route.ts

lib/supabase/migrations/
└── 004_mayar_migration.sql

docs/mayar-setup.md
```

## Implementation Phases

### Phase 1: Database Migration
- [ ] Run SQL migration to rename columns
- [ ] Regenerate TypeScript types (`bunx supabase gen types`)

### Phase 2: Create Mayar Integration
- [ ] Create `lib/mayar/config.ts`
- [ ] Create `lib/mayar/types.ts`
- [ ] Create `lib/mayar/client.ts`
- [ ] Create `app/api/mayar/create-payment/route.ts`
- [ ] Create `app/api/mayar/webhook/route.ts`

### Phase 3: Update Checkout
- [ ] Remove `useMidtransSnap` hook usage
- [ ] Update checkout page to redirect flow
- [ ] Update/create success page for order lookup

### Phase 4: Cleanup
- [ ] Delete `lib/midtrans/` directory
- [ ] Delete `app/api/midtrans/` directory
- [ ] Delete `hooks/useMidtransSnap.ts`
- [ ] Move voucher-service to `lib/payment/`
- [ ] Update documentation

### Phase 5: Testing
- [ ] Test dengan Mayar sandbox
- [ ] Verify end-to-end flow
- [ ] Deploy to production

## Testing Strategy

### Sandbox Testing
- Use `api.mayar.club` + API key from `web.mayar.club`
- Test create payment → redirect → webhook flow
- No real money required

### Manual Testing Checklist
- [ ] Create payment returns valid `paymentLink`
- [ ] Redirect ke Mayar page berhasil
- [ ] Payment di sandbox berhasil
- [ ] Webhook received dan order updated
- [ ] Voucher created dan email sent
- [ ] Success page shows voucher details

### Webhook Testing
- Use ngrok/localtunnel to expose localhost
- Register webhook URL via Mayar API or dashboard
- Test dengan manual POST to `/api/mayar/webhook`

### Rollback Plan
- Migration SQL can be reversed (rename columns back)
- Git branch for safe rollback
- No data loss (only column renames)

## References

- [Mayar API Documentation](https://docs.mayar.id/api-reference/introduction)
- [Mayar Create Payment](https://docs.mayar.id/api-reference/reqpayment/create)
- [Mayar Webhook](https://docs.mayar.id/api-reference/webhook/history)
- [Supabase Postgres Best Practices](skill://supabase-postgres-best-practices)

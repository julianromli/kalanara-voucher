# 005 — Make voucher delivery idempotent

- **Status**: DONE
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 6–8 files, one additive migration plus fulfillment code/tests

## Problem

`lib/payment/voucher-service.ts:220-248` delivers after both newly-created and existing vouchers:

```ts
// lib/payment/voucher-service.ts:220-248 — current
export async function createVoucherOnPaymentSuccess(
  order: OrderWithService
): Promise<VoucherCreationResult> {
  try {
    const orderItems = await getOrderItemsByOrderId(order.id);
    if (orderItems.length > 0) {
      const createdVouchers = await Promise.all(
        orderItems.map((item) => createVoucherForOrderItem(order, item))
      );
      const firstVoucher = createdVouchers.find(Boolean);

      if (firstVoucher && !order.voucher_id) {
        await updateOrderVoucherId(order.id, firstVoucher.id);
      }

      await Promise.all(orderItems.map((item) => triggerSingleVoucherDelivery(order, item)));
      // ...
    }

    const result = await createSingleVoucher(order);
    if (result.success) {
      await triggerSingleVoucherDelivery(order);
    }
```

The helper at `lib/payment/voucher-service.ts:199-217` has no durable claim:

```ts
const deliveryMethod = item?.delivery_method ?? order.delivery_method;
const itemId = item?.id;

if (deliveryMethod === "EMAIL" || deliveryMethod === "BOTH") {
  await sendVoucherEmail(order.payment_order_id, order.public_access_token, itemId);
}
if (deliveryMethod === "WHATSAPP" || deliveryMethod === "BOTH") {
  await sendVoucherWhatsApp(order.payment_order_id, order.public_access_token, itemId);
}
```

`lib/scalev/reconcile.ts:162-175` and `app/api/scalev/webhook/route.ts:430-446` independently perform check-then-call fulfillment:

```ts
// lib/scalev/reconcile.ts:162-175 — current
const refreshedBeforeFulfillment = await getPublicOrderDetailsWithItems(
  paymentOrderId,
  publicAccessToken
);
const alreadyFulfilled =
  refreshedBeforeFulfillment?.order_items.length
    ? refreshedBeforeFulfillment.order_items.every((item) => item.voucher_id)
    : Boolean(existingPublicOrder.voucher_id);
const latestOrder = alreadyFulfilled
  ? null
  : await getOrderByPaymentOrderIdAndAccessToken(paymentOrderId, publicAccessToken);
if (latestOrder) {
  await createVoucherOnPaymentSuccess(latestOrder);
}
```

```ts
// app/api/scalev/webhook/route.ts:430-446 — current
const alreadyFulfilled = await isOrderAlreadyFulfilled(order);
if (alreadyFulfilled) {
  processingMessage = "Payment completed; vouchers already fulfilled";
} else {
  const result = await createVoucherOnPaymentSuccess({
    ...order,
    payment_status: "COMPLETED",
  });
```

Voucher uniqueness does not protect delivery. Concurrent webhook/public reconciliation or a later retry can send the same voucher/channel more than once.

## Target

Use a database-backed outbox whose unique source/channel key is the concurrency authority:

```sql
-- lib/supabase/migrations/020_add_voucher_delivery_outbox.sql — target
CREATE TYPE public.voucher_delivery_channel AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE public.voucher_delivery_status AS ENUM
  ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE public.voucher_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  channel public.voucher_delivery_channel NOT NULL,
  status public.voucher_delivery_status NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX voucher_delivery_outbox_item_channel_unique
  ON public.voucher_delivery_outbox(order_item_id, channel)
  WHERE order_item_id IS NOT NULL;
CREATE UNIQUE INDEX voucher_delivery_outbox_legacy_order_channel_unique
  ON public.voucher_delivery_outbox(order_id, channel)
  WHERE order_item_id IS NULL;
CREATE INDEX voucher_delivery_outbox_retryable_idx
  ON public.voucher_delivery_outbox(next_attempt_at, created_at)
  WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');

ALTER TABLE public.voucher_delivery_outbox ENABLE ROW LEVEL SECURITY;
```

Define one `SECURITY DEFINER SET search_path = ''` RPC that fully qualifies every object and accepts `p_order_id`, nullable `p_order_item_id`, `p_voucher_id`, and `p_channels`. Revoke default/public execution and grant only the trusted server role. In one transaction it must:

1. insert requested channels with `ON CONFLICT DO NOTHING`;
2. select only that source’s `PENDING`, due `FAILED`, or stale `PROCESSING` rows (`claimed_at < now() - interval '5 minutes'`) using `FOR UPDATE SKIP LOCKED`;
3. atomically set them to `PROCESSING`, increment `attempt_count`, set `claimed_at/updated_at`, clear `last_error`, and return `{ id, channel }`;
4. perform no HTTP/provider work.

```ts
// lib/payment/voucher-delivery-outbox.ts — target API
export type VoucherDeliveryChannel = "EMAIL" | "WHATSAPP";
export interface ClaimedVoucherDelivery {
  id: string;
  channel: VoucherDeliveryChannel;
}

export async function claimVoucherDeliveries(input: {
  orderId: string;
  orderItemId: string | null;
  voucherId: string;
  channels: VoucherDeliveryChannel[];
}): Promise<ClaimedVoucherDelivery[]>;
export async function markVoucherDeliverySent(deliveryId: string): Promise<void>;
export async function markVoucherDeliveryFailed(
  deliveryId: string,
  error: unknown
): Promise<void>;
```

`markVoucherDeliverySent` sets `SENT`, `sent_at/updated_at`, and clears claim/error fields. `markVoucherDeliveryFailed` sets `FAILED`, clears `claimed_at`, stores a bounded error, and sets exponential `next_attempt_at` capped at 60 minutes. Both use `getAdminClient()` and throw on persistence failure.

```ts
// lib/payment/voucher-service.ts — target orchestration
const claimed = await claimVoucherDeliveries({
  orderId: order.id,
  orderItemId: item?.id ?? null,
  voucherId: voucher.id,
  channels: getDeliveryChannels(item?.delivery_method ?? order.delivery_method),
});

await Promise.all(
  claimed.map(async (delivery) => {
    try {
      if (delivery.channel === "EMAIL") {
        await sendVoucherEmail(
          order.payment_order_id!,
          order.public_access_token!,
          item?.id
        );
      } else {
        await sendVoucherWhatsApp(
          order.payment_order_id!,
          order.public_access_token!,
          item?.id
        );
      }
      await markVoucherDeliverySent(delivery.id);
    } catch (error) {
      await markVoucherDeliveryFailed(delivery.id, error);
      throw error;
    }
  })
);
```

Pass each concrete `Voucher` returned/reused by item or single-voucher creation into this orchestration. A second invocation while the row is `PROCESSING` or `SENT` claims nothing; due `FAILED` and stale `PROCESSING` rows are retryable. Update `lib/database.types.ts` with exact table, enum, and RPC types.

## Repo conventions to follow

- Imitate duplicate-safe server persistence in `lib/actions/scalevWebhookEvents.ts:10-42`.
- Imitate source uniqueness in `lib/supabase/migrations/015_add_voucher_source_order_item_id.sql:20-28`.
- Keep payment orchestration beside `lib/payment/public-voucher-delivery.ts:93-127`.
- Extend the hoisted Vitest mocks in `lib/payment/voucher-service.test.ts:1-93`.
- Follow typed RPC declarations at `lib/database.types.ts:709-751`.

## Steps

1. Add migration `020_add_voucher_delivery_outbox.sql` with the exact schema/index/RLS/RPC contract above; deny direct anon access.
2. Add generated-equivalent table, enum, aliases, and RPC result types to `lib/database.types.ts`.
3. Add `lib/payment/voucher-delivery-outbox.ts` using `getAdminClient()` and explicit error checks for claim/SENT/FAILED transitions.
4. Replace `triggerSingleVoucherDelivery` at `lib/payment/voucher-service.ts:199-217` with channel expansion and claimed delivery. Preserve EMAIL/WHATSAPP/BOTH and no-item compatibility.
5. Refactor the single branch to retain the concrete new/existing voucher while keeping exported `VoucherCreationResult` unchanged.
6. Keep webhook/reconcile preflight checks only as fast paths; correctness must depend on the durable claim.
7. Test concurrent duplicate calls, BOTH keys, existing voucher plus SENT, due FAILED retry, non-stale/stale PROCESSING, and failure persistence in `lib/payment/voucher-service.test.ts`.
8. Add an RPC integration test when available; otherwise verify with two concurrent SQL sessions.
9. Remove unrelated diff churn.

## Boundaries

- Do NOT make fetch, Resend, WhatsApp, or any external send inside a DB transaction/RPC.
- Do NOT use in-memory locks or check-then-act reads as the uniqueness authority.
- Do NOT alter payment/discount transitions, voucher contents, recipient selection, authorization, or delivery methods.
- Do NOT expose the outbox through anon RLS or client code; do not add dependencies.
- Keep legacy no-item orders on the partial `(order_id, channel)` key; all item fulfillment uses unique `(order_item_id, channel)`.
- A claim cannot guarantee mathematical exactly-once behavior if provider success is followed by DB failure. Preserve provider idempotency keys where supported and document this crash window.
- STOP if code drifted from commit `b94c4ae`; report it instead of improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not regress the score (Beyond-scan finding).
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run test:run -- lib/payment/voucher-service.test.ts lib/scalev/reconcile.test.ts app/api/scalev/webhook/route.test.ts`
  - Apply the migration in disposable Postgres; two concurrent claims for one item/channel yield one row and one returned claim.
- **Behavior check**: Complete a BOTH checkout, concurrently invoke signed webhook and public-status reconciliation, and confirm exactly one EMAIL and one WHATSAPP row per item reaches SENT. Force one channel failure and confirm only that due channel retries.
- **Done when**: PostgreSQL enforces item/channel uniqueness, claims are atomic/retryable, sends occur after the transaction, race tests pass, and Doctor/typecheck/lint/tests/behavior checks pass.

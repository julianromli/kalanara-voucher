# 004 — Enforce an atomic payment state machine

- **Status**: DONE
- **Commit**: b94c4ae
- **Title**: Enforce an atomic payment state machine
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 8–12 files; one database migration/RPC, typed server wrapper, webhook/reconciliation callers, and concurrency tests

## Problem

Payment state is updated with unconditional service-role writes. Concurrent, duplicated, delayed, or out-of-order provider observations can regress a terminal order and trigger downstream discount/voucher work even when the status write failed.

`lib/actions/orders.ts:603-651` performs an unconditional update and makes metadata-only persistence force the order back to `PENDING`:

```ts
export async function updateOrderPaymentStatus(
  orderId: string,
  status: PaymentStatus,
  paymentData?: GatewayPaymentUpdate
): Promise<boolean> {
  const supabase = getAdminClient();
  const updateData: OrderUpdate = {
    payment_status: status,
  };

  if (paymentData) {
    updateData.payment_provider = paymentData.paymentProvider || updateData.payment_provider;
    updateData.payment_transaction_id =
      paymentData.transactionId ?? paymentData.transaction_id ?? null;
    updateData.payment_type =
      paymentData.paymentType ?? paymentData.payment_type ?? null;
    updateData.payment_transaction_time =
      paymentData.transactionTime ?? paymentData.transaction_time ?? null;
    updateData.payment_link = paymentData.paymentLink ?? null;
    updateData.scalev_order_pk = paymentData.scalevOrderPk ?? null;
    updateData.scalev_order_id = paymentData.scalevOrderId ?? null;
    updateData.scalev_pg_reference_id = paymentData.scalevPgReferenceId ?? null;
    updateData.scalev_payment_method = paymentData.scalevPaymentMethod ?? null;
    updateData.scalev_sub_payment_method = paymentData.scalevSubPaymentMethod ?? null;
    updateData.scalev_store_unique_id = paymentData.scalevStoreUniqueId ?? null;
    updateData.scalev_last_checked_at = paymentData.scalevLastCheckedAt ?? null;
    updateData.scalev_raw_status = paymentData.scalevRawStatus ?? null;
    updateData.scalev_raw_payment_status = paymentData.scalevRawPaymentStatus ?? null;
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (error) {
    console.error("Error updating gateway order status:", error);
    return false;
  }

  revalidateTag("dashboard-stats", "max");
  return true;
}

export async function updateOrderGatewayData(
  orderId: string,
  updates: GatewayPaymentUpdate
): Promise<boolean> {
  return updateOrderPaymentStatus(orderId, "PENDING", updates);
}
```

Thus a reconciliation metadata refresh arriving after `COMPLETED` can write `PENDING`. Separate read/check/write operations in TypeScript cannot prevent this race because another worker can update the row between them.

The webhook ignores every update result. At `app/api/scalev/webhook/route.ts:354-369`, it records success even if persistence failed:

```ts
if (normalizedStatus === "PENDING") {
  await updateOrderGatewayData(order.id, gatewayUpdate);
  if (webhookEvent) {
    await updateScalevWebhookEvent(webhookEvent.id, {
      order_id: order.id,
      processing_status: "processed",
      processing_message: "Pending status recorded",
      processed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ status: "ok", message: "Pending status recorded" });
}

if (normalizedStatus === "FAILED") {
  await updateOrderPaymentStatus(order.id, "FAILED", gatewayUpdate);
  const redemptionVoided = await markDiscountRedemptionVoid(order.id);
```

At `app/api/scalev/webhook/route.ts:399-414`, refund/completion writes are also unchecked:

```ts
if (normalizedStatus === "REFUNDED") {
  await updateOrderPaymentStatus(order.id, "REFUNDED", gatewayUpdate);
  if (webhookEvent) {
    await updateScalevWebhookEvent(webhookEvent.id, {
      order_id: order.id,
      processing_status: "processed",
      processing_message: "Refund status recorded",
      processed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ status: "ok", message: "Refund status recorded" });
}

await updateOrderPaymentStatus(order.id, "COMPLETED", gatewayUpdate);
const redemptionSucceeded = await markDiscountRedemptionSucceeded(order.id);
```

Voucher fulfillment then runs against an in-memory object forced to completed at `app/api/scalev/webhook/route.ts:434-445`, regardless of whether the database accepted completion:

```ts
const alreadyFulfilled = await isOrderAlreadyFulfilled(order);
if (alreadyFulfilled) {
  processingMessage = "Payment completed; vouchers already fulfilled";
} else {
  try {
    const result = await createVoucherOnPaymentSuccess({
      ...order,
      payment_status: "COMPLETED",
    });
```

Reconciliation first forces metadata to `PENDING` and ignores the boolean at `lib/scalev/reconcile.ts:114-138`:

```ts
const snapshot = buildPaymentSnapshot(latestPayment, settlement);

await updateOrderGatewayData(existingPublicOrder.id, {
  paymentProvider: "scalev",
  transactionId:
    snapshot.pgReferenceId || existingPublicOrder.payment_transaction_id,
  paymentType: snapshot.paymentMethod,
  transactionTime: new Date().toISOString(),
  paymentLink: snapshot.paymentLink || existingPublicOrder.payment_link,
  scalevOrderPk: snapshot.orderPk || orderPk,
  scalevOrderId: snapshot.orderId || existingPublicOrder.scalev_order_id,
  scalevPgReferenceId:
    snapshot.pgReferenceId || existingPublicOrder.scalev_pg_reference_id,
  scalevPaymentMethod:
    snapshot.paymentMethod || existingPublicOrder.scalev_payment_method,
  scalevSubPaymentMethod:
    snapshot.subPaymentMethod || existingPublicOrder.scalev_sub_payment_method,
  scalevStoreUniqueId: existingPublicOrder.scalev_store_unique_id,
  scalevRawStatus: snapshot.rawStatus,
  scalevRawPaymentStatus: snapshot.rawPaymentStatus,
  scalevLastCheckedAt: new Date().toISOString(),
});

if (snapshot.normalizedStatus === "COMPLETED") {
  await updateOrderPaymentStatus(existingPublicOrder.id, "COMPLETED", {
```

It continues to discount synchronization and fulfillment without checking the update at `lib/scalev/reconcile.ts:156-174`:

```ts
});
const redemptionMarked = await markDiscountRedemptionSucceeded(existingPublicOrder.id);
if (!redemptionMarked) {
  throw new Error("Failed to synchronize discount redemption after payment success.");
}
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

The webhook does have a provider event-time extractor at `app/api/scalev/webhook/route.ts:107-117`, but the persistence layer does not use it for ordering:

```ts
function extractWebhookTransactionTime(
  payload: ScalevWebhookPaymentStatusChangedData
): string {
  return (
    payload.settled_time ||
    payload.paid_time ||
    payload.conflict_time ||
    payload.unpaid_time ||
    payload.last_updated_at ||
    new Date().toISOString()
  );
}
```

## Target

Make PostgreSQL the single atomic authority for provider-driven status transitions. Use a row lock inside one RPC invocation, an explicit transition matrix, provider event time, and a monotonic local version.

Allowed provider transitions:

| Current | Requested | Result |
|---|---|---|
| `PENDING` | `PENDING` | accepted idempotent/metadata refresh |
| `PENDING` | `COMPLETED` | accepted |
| `PENDING` | `FAILED` | accepted |
| `COMPLETED` | `COMPLETED` | accepted idempotent |
| `COMPLETED` | `REFUNDED` | accepted |
| `FAILED` | `FAILED` | accepted idempotent |
| `REFUNDED` | `REFUNDED` | accepted idempotent |
| Any other pair | — | rejected; no write and no downstream work |

In particular, `COMPLETED -> PENDING`, `COMPLETED -> FAILED`, `REFUNDED -> COMPLETED`, and terminal-to-pending transitions are forbidden. A provider claiming a late success after local `FAILED` must be recorded for manual investigation, not silently mutate a terminal order.

Add ordering/version columns:

```sql
alter table public.orders
  add column payment_provider_event_at timestamptz,
  add column payment_state_version bigint not null default 0;
```

The migration must define an RPC with this contract. The following is the concrete target core; include all existing gateway metadata as explicit assignments rather than allowing arbitrary JSON to update protected columns:

```sql
create or replace function public.transition_order_payment_state(
  p_order_id uuid,
  p_target_status public.payment_status,
  p_provider text,
  p_provider_event_at timestamptz,
  p_expected_version bigint default null,
  p_transaction_id text default null,
  p_payment_type text default null,
  p_payment_link text default null,
  p_scalev_order_pk bigint default null,
  p_scalev_order_id text default null,
  p_scalev_pg_reference_id text default null,
  p_scalev_raw_status text default null,
  p_scalev_raw_payment_status text default null,
  p_scalev_last_checked_at timestamptz default null
)
returns table (
  accepted boolean,
  changed boolean,
  reason text,
  previous_status public.payment_status,
  current_status public.payment_status,
  state_version bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.payment_status;
  v_event_at timestamptz;
  v_version bigint;
  v_changed boolean;
begin
  select o.payment_status, o.payment_provider_event_at, o.payment_state_version
    into v_status, v_event_at, v_version
  from public.orders as o
  where o.id = p_order_id
  for update;

  if not found then
    return query select false, false, 'not_found', null::public.payment_status,
      null::public.payment_status, null::bigint;
    return;
  end if;

  if p_provider_event_at is null then
    return query select false, false, 'missing_provider_event_at',
      v_status, v_status, v_version;
    return;
  end if;

  if p_expected_version is not null and p_expected_version <> v_version then
    return query select false, false, 'version_conflict',
      v_status, v_status, v_version;
    return;
  end if;

  if v_event_at is not null and p_provider_event_at < v_event_at then
    return query select false, false, 'stale_provider_event',
      v_status, v_status, v_version;
    return;
  end if;

  if not (
    p_target_status = v_status
    or (v_status = 'PENDING' and p_target_status in ('COMPLETED', 'FAILED'))
    or (v_status = 'COMPLETED' and p_target_status = 'REFUNDED')
  ) then
    return query select false, false, 'transition_rejected',
      v_status, v_status, v_version;
    return;
  end if;

  v_changed := p_target_status <> v_status;

  update public.orders as o
  set payment_status = p_target_status,
      payment_provider = coalesce(p_provider, o.payment_provider),
      payment_provider_event_at = p_provider_event_at,
      payment_state_version = o.payment_state_version + 1,
      payment_transaction_id = coalesce(p_transaction_id, o.payment_transaction_id),
      payment_type = coalesce(p_payment_type, o.payment_type),
      payment_link = coalesce(p_payment_link, o.payment_link),
      scalev_order_pk = coalesce(p_scalev_order_pk, o.scalev_order_pk),
      scalev_order_id = coalesce(p_scalev_order_id, o.scalev_order_id),
      scalev_pg_reference_id =
        coalesce(p_scalev_pg_reference_id, o.scalev_pg_reference_id),
      scalev_raw_status = coalesce(p_scalev_raw_status, o.scalev_raw_status),
      scalev_raw_payment_status =
        coalesce(p_scalev_raw_payment_status, o.scalev_raw_payment_status),
      scalev_last_checked_at =
        coalesce(p_scalev_last_checked_at, o.scalev_last_checked_at)
  where o.id = p_order_id
  returning o.payment_state_version into v_version;

  return query select true, v_changed,
    case when v_changed then 'applied' else 'idempotent' end,
    v_status, p_target_status, v_version;
end;
$$;

revoke all on function public.transition_order_payment_state(
  uuid, public.payment_status, text, timestamptz, bigint,
  text, text, text, bigint, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.transition_order_payment_state(
  uuid, public.payment_status, text, timestamptz, bigint,
  text, text, text, bigint, text, text, text, text, timestamptz
) to service_role;
```

Before implementing the migration, verify actual generated column types; adjust parameter types to match them exactly. Add every currently persisted gateway field explicitly. Do not use `jsonb_populate_record`, dynamic SQL, or client-supplied column names.

The TypeScript wrapper must return a discriminated result, not a lossy boolean:

```ts
export type PaymentTransitionResult =
  | {
      accepted: true;
      changed: boolean;
      reason: "applied" | "idempotent";
      previousStatus: PaymentStatus;
      currentStatus: PaymentStatus;
      stateVersion: number;
    }
  | {
      accepted: false;
      changed: false;
      reason:
        | "not_found"
        | "missing_provider_event_at"
        | "version_conflict"
        | "stale_provider_event"
        | "transition_rejected"
        | "database_error";
      currentStatus?: PaymentStatus;
      stateVersion?: number;
    };
```

```ts
const transition = await transitionOrderPaymentState({
  orderId: order.id,
  targetStatus: normalizedStatus,
  provider: "scalev",
  providerEventAt,
  gatewayUpdate,
});

if (!transition.accepted) {
  await markWebhookEventRejected(webhookEvent, transition.reason);
  return NextResponse.json(
    { status: "ok", message: "Payment state update rejected" },
    { status: 200 }
  );
}

// Only accepted COMPLETED may synchronize redemption and fulfill vouchers.
if (transition.currentStatus === "COMPLETED") {
  await synchronizeCompletedOrder(order.id);
}
```

Metadata-only gateway persistence must either call the RPC with the row’s current status or use a separate atomic metadata RPC that never writes `payment_status`; it must never default to `PENDING`. Prefer the single transition RPC so timestamp/version ordering remains centralized.

## Repo conventions to follow

- Put the RPC migration in `lib/supabase/migrations/` and update/regenerate `lib/database.types.ts`.
- Keep the TypeScript wrapper in a server-only module, not an externally callable `"use server"` export.
- Preserve signed-webhook validation, 200 responses for handled webhook duplicates/rejections, event audit records, discount idempotency, voucher idempotency, and dashboard revalidation.
- Use the existing `getAdminClient()` service-role path for the RPC. The function is `SECURITY INVOKER`; do not add `SECURITY DEFINER` unless a reviewed privilege need is proven.
- Keep a fixed empty `search_path`, fully qualify database objects, revoke default/public execution, and grant only `service_role`.

## Steps

1. Add a migration for `payment_provider_event_at`, `payment_state_version`, and `transition_order_payment_state`. Verify exact enum/column types and include every gateway metadata field through explicit typed parameters.
2. Add SQL tests that run transitions concurrently and out of order. Cover the full matrix, stale timestamps, expected-version conflicts, equal-status idempotency, not-found rows, and rollback on rejection.
3. Regenerate/update database types and create a server-only typed RPC wrapper. Treat Supabase errors, empty/malformed RPC rows, and rejected transitions as explicit failures.
4. Replace `updateOrderPaymentStatus`/`updateOrderGatewayData` in Scalev webhook and reconciliation paths with the RPC wrapper. Remove the behavior that forces metadata updates to `PENDING`.
5. Extend `ScalevPaymentSnapshot` to carry the provider’s `last_updated_at`/paid/settled/conflict/unpaid event timestamp. Use receipt time only when Scalev supplies no event time, and document/log that fallback without including PII.
6. In the webhook, check the result before marking the webhook event processed, changing discount redemption, or fulfilling vouchers. Record rejected/stale/version-conflict outcomes in the webhook event and stop.
7. In reconciliation, check each result and stop before discount/voucher work on rejected or failed updates. Re-fetch the accepted current order before fulfillment; do not force an in-memory object to `COMPLETED`.
8. Preserve idempotent recovery: an accepted `COMPLETED -> COMPLETED` observation may retry incomplete downstream fulfillment, but a rejected transition may not.
9. Update route/reconciliation tests and add focused wrapper tests for database errors and every rejection reason. Verify create-payment’s existing checked persistence behavior remains checked.

## Boundaries

- Do NOT implement the state machine as a TypeScript read-then-write check; it is not atomic.
- Do NOT permit terminal-state regression to `PENDING`.
- Do NOT continue discount, refund, or voucher side effects after a rejected, stale, conflicting, malformed, or failed RPC result.
- Do NOT trust webhook arrival order or local receipt time when a valid provider event timestamp exists.
- Do NOT expose the RPC to `anon` or `authenticated`, add permissive RLS, or move the service-role key to client code.
- Do NOT use `SECURITY DEFINER` casually. If it becomes necessary, require a fixed empty `search_path`, fully qualified objects, ownership review, and explicit execute grants.
- Do NOT fold discount redemption and voucher delivery into the database transaction; those external/application side effects remain idempotent follow-up work after an accepted transition.
- Do NOT redesign unrelated admin status controls in this plan.
- STOP if schema or code has drifted from commit `b94c4ae`; report the drift and re-derive the transition matrix instead of improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` completes without a new diagnostic and the score does not regress.
  - `bunx tsc --noEmit`
  - `bun run lint`
  - Focused tests: `bun run test:run -- app/api/scalev/webhook/route.test.ts lib/scalev/reconcile.test.ts app/api/scalev/create-payment/route.test.ts lib/payment/voucher-service.test.ts`
  - Run the new migration/RPC SQL tests against an isolated Supabase/Postgres database.
  - Full tests: `bun run test:run`
- **Behavior check**: Process normal pending, completed, failed, refunded, duplicate-completed, and reconciliation flows. Confirm pending UI polling still updates, accepted completion fulfills vouchers once, accepted failure voids the discount, accepted refund is displayed, and duplicate completion can safely recover incomplete idempotent fulfillment.
- **Security/correctness check**:
  - Race `PENDING -> COMPLETED` against stale `PENDING`; final state must remain `COMPLETED`.
  - Replay older failed/pending events after completion and older completed events after refund; RPC must reject them and downstream functions must not run.
  - Force an RPC database error and version conflict; webhook/reconcile must record failure/rejection and stop.
  - Call the RPC as `anon` and `authenticated`; execution must be denied. Call through the server service-role path; RLS/privileges must permit only that trusted path.
- **Done when**: all provider-driven payment writes use the atomic RPC, the allowed transition matrix and timestamp/version checks hold under concurrency, callers stop on non-accepted results, privileges are least-privilege, and focused/full/behavioral/security checks pass.

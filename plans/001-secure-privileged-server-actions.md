# 001 — Secure privileged server actions

- **Status**: DONE
- **Commit**: b94c4ae
- **Title**: Secure privileged server actions
- **Severity**: HIGH
- **Category**: Security
- **Rule**: react-doctor/server-auth-actions
- **Estimated scope**: 8–12 files; action boundaries, server-only payment helpers, and authorization tests

## Problem

A file marked `"use server"` turns every exported async function into a directly callable Server Action—a public POST endpoint, not a trusted in-process helper. Four exports perform service-role writes without first authenticating and authorizing the caller.

`lib/actions/vouchers.ts:247-275` currently accepts a database-shaped payload and immediately bypasses RLS:

```ts
export async function createVoucher(
  voucherData: Omit<VoucherInsert, "code">,
): Promise<Voucher | null> {
  // Use admin client to bypass RLS for trusted server operations
  const supabase = getAdminClient();

  // Generate unique code
  let code = generateVoucherCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from("vouchers")
      .select("id")
      .eq("code", code)
      .single();

    if (!existing) break;
    code = generateVoucherCode();
    attempts++;
  }

  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      ...voucherData,
      code,
    } as Database["public"]["Tables"]["vouchers"]["Insert"])
```

`lib/actions/orders.ts:189-200` permits arbitrary order creation:

```ts
export async function createOrder(order: OrderInsert): Promise<Order | null> {
  const supabase = getAdminClient();
  const orderPayload: OrderInsert = {
    ...order,
    subtotal_amount: order.subtotal_amount ?? order.total_amount,
    discount_amount: order.discount_amount ?? 0,
  };
  const { data, error } = await supabase
    .from("orders")
    .insert(orderPayload as Database["public"]["Tables"]["orders"]["Insert"])
    .select()
    .single();
```

`lib/actions/reviews.ts:145-151` permits arbitrary review creation:

```ts
export async function createReview(review: ReviewInsert): Promise<Review | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert(review)
    .select()
    .single();
```

`lib/actions/orders.ts:392-419` permits arbitrary order-item creation:

```ts
export async function createPendingOrderItems(
  items: readonly ScalevPendingOrderItemData[]
): Promise<OrderItem[] | null> {
  if (items.length === 0) {
    return [];
  }

  const supabase = getAdminClient();
  const insertRows = items.map((item, index) => ({
    order_id: item.order_id,
    service_id: item.service_id,
    original_unit_price: item.original_unit_price,
    discount_amount: item.discount_amount,
    final_unit_price: item.final_unit_price,
    unit_price: item.unit_price,
    recipient_name: item.recipient_name,
    recipient_email: item.recipient_email || null,
    recipient_phone: item.recipient_phone || null,
    sender_message: item.sender_message || null,
    delivery_method: item.delivery_method,
    send_to: item.send_to,
    sort_order: item.sort_order ?? index,
  } satisfies OrderItemInsert));

  const { data, error } = await supabase
    .from("order_items")
    .insert(insertRows as Database["public"]["Tables"]["order_items"]["Insert"][])
    .select();
```

React Doctor reports at `react-doctor-report.json:6958-6965`:

> Server action "createPendingOrderItems" performs unauthenticated privileged server work (.insert()), so anyone can trigger it directly.
>
> Check auth before changing server state or invoking billable services because exported server actions can be called directly by unauthenticated clients.

The globally mounted client store imports three of these actions at `context/StoreContext.tsx:21-28`:

```ts
// Server actions
import { getServices } from '@/lib/actions/services';
import {
  createVoucher as createVoucherAction,
  redeemVoucher as redeemVoucherAction,
} from '@/lib/actions/vouchers';
import { createOrder as createOrderAction } from '@/lib/actions/orders';
import { getReviews, createReview as createReviewAction } from '@/lib/actions/reviews';
```

It publishes wrappers at `context/StoreContext.tsx:34-44`:

```ts
interface StoreContextType {
  services: FrontendService[];
  vouchers: FrontendVoucher[];
  orders: FrontendOrder[];
  reviews: FrontendReview[];
  isLoading: boolean;
  error: string | null;
  addVoucher: (voucher: FrontendVoucher) => Promise<void>;
  addOrder: (order: FrontendOrder) => Promise<void>;
  addReview: (review: FrontendReview) => Promise<void>;
  redeemVoucher: (code: string) => Promise<{ success: boolean; message: string }>;
```

At `context/StoreContext.tsx:480-489`, those callbacks are included in every provider value:

```ts
    addVoucher,
    addOrder,
    addReview,
    redeemVoucher,
    getVoucherByCode,
    getServiceById,
    refreshData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
```

Repository search at this commit finds no caller of `addVoucher`, `addOrder`, or `addReview` outside `StoreContext.tsx`. The provider exposure is unused and keeps privileged action references in the client graph. The wrappers also trust IDs, prices, payment state, and database insert shapes assembled by a client.

## Target

Inline canonical `server-auth-actions` recipe for every externally callable privileged action:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function privilegedAction(input: PrivilegedActionInput) {
  // First statement: Server Actions are public POST endpoints.
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  // Load the resource on the server and authorize this caller for it.
  const resource = await loadResourceForAuthorization(input.resourceId);
  if (!resource || resource.ownerId !== user.id) {
    throw new Error("Forbidden");
  }

  // Do not trust caller-supplied owner/order/voucher IDs, roles, prices,
  // payment state, or other privileged fields.
  return mutateAuthorizedResource(resource, pickAllowedFields(input));
}
```

For admin entry points, the repository’s central guard must be the literal first statement:

```ts
export async function createReview(input: CreateAdminReviewInput) {
  const access = await requireAdminPermission(AdminPermission.REVIEWS_MANAGE);
  const resource = await loadAuthorizedReviewResource(input.voucherId, access);
  return createReviewRecord(buildAuthorizedReview(input, resource, access.userId));
}
```

`lib/auth/admin-rbac-server.ts:66-85` is the local authentication exemplar:

```ts
export const getCurrentAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id, email, name, role")
    .eq("id", user.id)
    .maybeSingle();
```

Authentication alone is not sufficient. The result must authorize the exact operation/resource. Adding an unused or late `auth.getUser()` call is a no-op auth “fix” and is prohibited.

Payment-only helpers must leave action modules entirely:

```ts
// lib/payment/order-writes.ts
import "server-only";

export async function createPendingOrderItemsForOrder(
  orderId: string,
  validatedItems: readonly ValidatedCheckoutItem[]
): Promise<OrderItem[]> {
  const supabase = getAdminClient();
  const order = await loadServerCreatedOrder(supabase, orderId);
  const services = await loadAuthoritativeServices(supabase, validatedItems);
  return insertOrderItems(
    supabase,
    buildItemsFromAuthoritativeOrder(order, services, validatedItems)
  );
}
```

```ts
// lib/payment/voucher-writes.ts
import "server-only";

export async function createVoucherForPaidOrderItem(
  paidOrder: PaidOrder,
  orderItem: UnfulfilledOrderItem
): Promise<Voucher> {
  return insertVoucher(buildVoucherFromPaidOrderItem(paidOrder, orderItem));
}
```

Trusted route handlers/webhook/reconciliation code may import those server-only helpers. They derive prices, status, order linkage, service linkage, voucher source item, and recipient data from validated/server-loaded records. They are not exported from `"use server"` modules and are never imported by Client Components.

Delete `createVoucher`, `createOrder`, or `createReview` if it has no legitimate external caller. If a privileged admin action must remain, retain only a narrow authenticated/authorized wrapper around a server-only record helper. Remove the unused `addVoucher`, `addOrder`, and `addReview` StoreContext members, implementations, imports, and values.

## Repo conventions to follow

- Use `requireAdminPermission`/`AdminPermission`, as shown by `lib/actions/orders.ts:211-230`; do not implement a parallel client-role check.
- Keep `"use server"` at action entry points and `import "server-only"` in internal privileged modules.
- Use `getAdminClient()` only after trust is established or inside server-only payment paths.
- Preserve `@/` imports, strict TypeScript, audit logging, revalidation, and existing Indonesian user-facing errors.
- Preserve `createPublicReview` as a separate voucher-authorized public flow; do not replace its resource validation with unrestricted `createReview`.

## Steps

1. At commit `b94c4ae`, inventory imports/callers of all four exports and classify each as an external admin action or a trusted payment route/webhook helper. Stop on unclassified callers.
2. Move payment-created order-item and voucher write bodies to `server-only` modules. Narrow inputs and derive privileged fields from the server-created order and authoritative services.
3. Update `app/api/scalev/create-payment/route.ts` and `lib/payment/voucher-service.ts` to use those internal helpers.
4. Delete unused external exports. For every retained privileged action, make `requireAdminPermission(...)` the first statement, check the exact permission/resource, whitelist input fields, and audit the authenticated actor.
5. Remove the three unused action imports/callbacks/type members/provider values from `context/StoreContext.tsx`.
6. Add tests for no session, normal user, admin lacking permission, and authorized admin. Assert denied calls never invoke an admin-client write.
7. Add tests proving foreign IDs, caller prices, payment state, roles, and voucher IDs cannot cross the trusted boundary, while validated checkout/webhook flows still create records.
8. Search all exports in `"use server"` files and manually verify every privileged mutation authenticates and authorizes as its first operation.

## Boundaries

- Do NOT add a no-op `auth.getUser()` merely to silence React Doctor.
- Do NOT trust complete `*Insert` objects, IDs, ownership, prices, roles, or payment state supplied by clients.
- Do NOT require admin login for public checkout; move trusted internals to server-only modules.
- Do NOT export service-role internals from `"use server"` or import them into client code.
- Do NOT weaken RLS or treat possession of a database ID as authorization.
- Do NOT broaden into unrelated Server Action cleanup.
- STOP if code differs from commit `b94c4ae`; report drift rather than improvising.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears the targeted `react-doctor/server-auth-actions` diagnostic and does not lower the score.
  - `bunx tsc --noEmit`
  - `bun run lint`
  - Focused tests: `bun run test:run -- lib/actions/__tests__/vouchers.test.ts lib/actions/__tests__/orders-create-pending.test.ts lib/actions/__tests__/reviews.test.ts app/api/scalev/create-payment/route.test.ts lib/payment/voucher-service.test.ts`
  - Full tests: `bun run test:run`
- **Behavior check**: Complete single/cart checkout and process a valid signed Scalev completion webhook. Confirm expected order items/vouchers are created once. Confirm retained authorized admin flows still work.
- **Security check**: Directly invoke each retained action with no session, a normal user, an underprivileged admin, foreign IDs, and tampered price/status fields. Every denied request must fail before service-role writes; server-authoritative values must win.
- **Done when**: no unauthenticated service-role mutation is externally callable, payment helpers are server-only, unused StoreContext exposure is gone, and focused/full/behavioral/security checks pass.

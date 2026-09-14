# 003 — Protect the order capability token

- **Status**: OPEN
- **Commit**: b94c4ae
- **Title**: Protect the order capability token
- **Severity**: HIGH
- **Category**: Security
- **Rule**: Beyond the scan
- **Estimated scope**: 10–14 files; secure status session, checkout/status flow, route layouts, migration, and tests

## Problem

Checkout returns the durable `orders.public_access_token` to JavaScript and places it in the success URL. Query strings persist in history and leak through copied URLs, screenshots, logs, analytics, errors, and referrers.

`app/api/scalev/create-payment/route.ts:539-548` currently returns the capability:

```ts
shouldVoidDiscountRedemption = false;
return NextResponse.json({
  success: true,
  paymentLink,
  orderId: scalevOrder.order_id || String(scalevOrder.id),
  paymentOrderId: order.payment_order_id,
  publicAccessToken: order.public_access_token,
  paymentMethod: validatedData.paymentMethod,
  subPaymentMethod: validatedData.subPaymentMethod,
});
```

`lib/scalev/types.ts:98-107` exposes it in the response contract:

```ts
export interface ScalevCreatePaymentResponse {
  success: boolean;
  paymentLink?: string;
  orderId?: string;
  paymentOrderId?: string;
  publicAccessToken?: string;
  paymentMethod?: ScalevPaymentMethod;
  subPaymentMethod?: ScalevVABankCode;
  error?: string;
  errorCode?: ScalevCreatePaymentErrorCode;
}
```

`app/checkout/[id]/checkout-page-client.tsx:455-468` requires it:

```ts
const result = (await response.json()) as {
  success: boolean;
  paymentLink?: string;
  paymentOrderId?: string;
  publicAccessToken?: string;
  error?: string;
};

if (
  !response.ok ||
  !result.success ||
  !result.paymentLink ||
  !result.paymentOrderId ||
  !result.publicAccessToken
) {
  throw new Error(result.error || "Gagal membuat pembayaran.");
}
```

`app/checkout/[id]/checkout-page-client.tsx:486-488` copies it into history:

```ts
router.push(
  `/checkout/success?order_id=${encodeURIComponent(result.paymentOrderId)}&token=${encodeURIComponent(result.publicAccessToken)}`
);
```

`app/checkout/cart/cart-checkout-client.tsx:474-480` repeats the leak:

```ts
startPendingCheckout(
  result.paymentOrderId,
  data.lineItems.map((item) => item.cartItemId)
);
router.push(
  `/checkout/success?order_id=${encodeURIComponent(result.paymentOrderId)}&token=${encodeURIComponent(result.publicAccessToken)}`
);
```

The status page consumes the URL token at `app/checkout/success/page.tsx:52-60`:

```ts
const searchParams = useSearchParams();
const router = useRouter();
const { showToast } = useToast();
const orderId = searchParams.get("order_id");
const token = searchParams.get("token");
const completePendingCheckout = useCartStore((state) => state.completePendingCheckout);
const clearPendingCheckout = useCartStore((state) => state.clearPendingCheckout);
const hasValidAccessLink = Boolean(orderId && token);
```

It sends the token from JavaScript at `app/checkout/success/page.tsx:80-97`:

```ts
const fetchStatus = useCallback(async () => {
  if (!orderId || !token) {
    throw new Error(INVALID_LINK_MESSAGE);
  }

  const response = await fetch("/api/orders/public-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ orderId, token }),
  });

  if (!response.ok) {
    throw new Error("Gagal memuat status pesanan.");
  }

  return (await response.json()) as PublicOrderStatusPayload;
}, [orderId, token]);
```

`app/api/orders/public-status/route.ts:4-21` accepts it from an untrusted body:

```ts
interface PublicStatusRequest {
  orderId?: string;
  token?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PublicStatusRequest | null;
  const orderId = body?.orderId;
  const token = body?.token;

  if (!orderId || !token) {
    return NextResponse.json(
      { error: "orderId and token are required" },
      { status: 400 }
    );
  }

  const payload = await reconcilePublicOrderStatus(orderId, token);
```

Possession reveals PII, voucher codes/status, and value. `lib/scalev/mappers.ts:134-145` returns:

```ts
return {
  voucherCode: voucher.code,
  paymentOrderId: order.payment_order_id || "",
  recipientName: item.recipient_name,
  recipientEmail: item.recipient_email,
  recipientPhone,
  senderName: order.customer_name,
  senderMessage: item.sender_message,
  serviceName: item.services?.name || "Layanan Spa",
  serviceDuration: item.services?.duration || 60,
  amount: item.unit_price,
  expiryDate: voucher.expiry_date,
```

`lib/scalev/mappers.ts:203-213` returns purchaser PII:

```ts
voucher: legacyVoucher,
vouchers: legacyVoucher ? [legacyVoucher] : [],
orderDetails: {
  customerName: order.customer_name,
  customerEmail: order.customer_email,
  customerPhone: order.customer_phone,
  subtotalAmount: order.subtotal_amount,
  discountAmount: order.discount_amount,
  discountCode: order.discount_code,
  totalAmount: order.total_amount,
  createdAt: order.created_at,
```

Meta Pixel is globally inherited by checkout/status/admin. `app/layout.tsx:3-10` imports it:

```tsx
import { Outfit, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import { MetaPixel } from "@/components/meta-pixel";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import { getSiteSetting } from "@/lib/actions/crm";
```

`app/layout.tsx:114-122` mounts it:

```tsx
<body
  suppressHydrationWarning
  className={`${outfit.variable} ${playfair.variable} ${geistMono.variable} font-sans antialiased`}
>
  <MetaPixel />
  <AuthProvider>
    <StoreProvider>
      <ToastProvider>
        <Suspense fallback={null}>
```

`components/meta-pixel.tsx:13-33` loads a third-party script and beacon in the sensitive document:

```tsx
<Script id="meta-pixel" strategy="afterInteractive">
  {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
  `}
</Script>
<noscript>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    height={1}
    width={1}
    style={{ display: "none" }}
    src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
```

## Target

Replace URL capability access with an opaque, server-mediated, 30-minute status session. Store only the token hash:

```sql
create table public.order_status_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index order_status_sessions_order_expiry_idx
  on public.order_status_sessions (order_id, expires_at);

alter table public.order_status_sessions enable row level security;
revoke all on public.order_status_sessions from anon, authenticated;
```

No anon/authenticated policy is added. A `server-only` service uses `getAdminClient()`, generates 32 random bytes, stores SHA-256 only, resolves by hash/order/expiry, and deletes expired sessions.

Create-payment returns a non-secret status-session ID and sets the matching raw secret only as a uniquely named secure cookie. The per-session cookie name preserves concurrent checkout tabs; the durable order token is omitted from JSON:

```ts
const statusToken = randomBytes(32).toString("base64url");
const statusSession = await createOrderStatusSession({
  orderId: order.id,
  tokenHash: createHash("sha256").update(statusToken).digest("hex"),
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
});

const response = NextResponse.json<ScalevCreatePaymentResponse>({
  success: true,
  paymentLink,
  orderId: scalevOrder.order_id || String(scalevOrder.id),
  paymentOrderId: order.payment_order_id,
  statusSessionId: statusSession.id,
  paymentMethod: validatedData.paymentMethod,
  subPaymentMethod: validatedData.subPaymentMethod,
});
response.cookies.set(`__Host-kalanara-status-${statusSession.id}`, statusToken, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: 30 * 60,
});
return response;
```

Production must always use `Secure`; isolate any localhost test accommodation in a server-only environment helper. The client response type has no `publicAccessToken`; it exposes only `statusSessionId`. Both clients navigate with non-secret order and session identifiers:

```ts
router.push(
  `/checkout/success?order_id=${encodeURIComponent(result.paymentOrderId)}&status_session_id=${encodeURIComponent(result.statusSessionId)}`
);
```

The status endpoint binds cookie, order, and expiry:

```ts
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    statusSessionId?: string;
  } | null;
  const orderId = body?.orderId;
  const statusSessionId = body?.statusSessionId;
  const rawToken = statusSessionId
    ? request.cookies.get(`__Host-kalanara-status-${statusSessionId}`)?.value
    : undefined;

  if (!orderId || !statusSessionId || !rawToken) {
    return NextResponse.json({ error: "Status session required" }, { status: 401 });
  }

  const session = await resolveActiveOrderStatusSession({
    sessionId: statusSessionId,
    orderId,
    tokenHash: createHash("sha256").update(rawToken).digest("hex"),
    now: new Date().toISOString(),
  });
  if (!session) {
    return NextResponse.json({ error: "Status session invalid or expired" }, { status: 401 });
  }

  const payload = await reconcilePublicOrderStatusByInternalOrderId(session.orderId);
  return payload
    ? NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
}
```

The durable `public_access_token` may temporarily remain for internal compatibility, but it never crosses browser JSON, URL, storage, analytics, logs, or errors.

Remove Meta Pixel from `app/layout.tsx` and place it only in an explicit non-sensitive marketing route group:

```tsx
// app/(marketing)/layout.tsx
import { MetaPixel } from "@/components/meta-pixel";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MetaPixel />
      {children}
    </>
  );
}
```

Move only approved marketing pages such as `/` and public service detail into `(marketing)`; route groups preserve URLs. Checkout/status, review/verify pages processing voucher capabilities, auth, and all admin pages stay outside. Their layouts must include no advertising, analytics, tag-manager, session-replay, chat, or other third-party script/beacon.

## Repo conventions to follow

- Use `server-only`, `getAdminClient()`, `@/` imports, strict TypeScript, and Indonesian user-facing errors.
- Keep sensitive responses `Cache-Control: private, no-store`.
- Preserve App Router URLs when introducing route groups.
- Follow least privilege: RLS enabled and no anon/authenticated table policy/grant.

## Steps

1. Add the status-session migration/types and server-only create/resolve/cleanup service.
2. Make create-payment create the short-lived session, set a per-session host-only HttpOnly/Secure/SameSite cookie, and return only its non-secret ID; remove `publicAccessToken` from JSON/type/logging.
3. Remove token checks and URL construction from both checkout clients; navigate with non-secret order and status-session IDs only.
4. Remove token parsing from success and post only `orderId` plus `statusSessionId` with same-origin credentials.
5. Make public-status resolve and authorize via cookie hash/order/expiry, then reconcile by server-resolved internal order.
6. Refactor reconciliation/lookups so no browser token is required; keep any temporary durable-token helper server-only.
7. Remove Meta Pixel from root, create the marketing-only layout, and keep every sensitive route outside it.
8. Update tests for cookie flags, no token in JSON/URL, expiry/tampering/cross-order rejection, no-store responses, and absence of all third-party resources on sensitive routes.
9. Add expired-session cleanup and cascade-delete coverage.

## Boundaries

- Do NOT expose durable/session token or hash in URL, JSON, JavaScript storage, logs, analytics, or errors.
- Do NOT use a JavaScript-readable cookie, authorize by order/session ID alone, or use one fixed cookie name that breaks concurrent checkout tabs.
- Do NOT “fix” this by stripping the URL after render; leakage has already occurred.
- Do NOT conditionally inject third parties after sensitive render; sensitive layouts must never contain them.
- Do NOT add permissive RLS or expose service-role code to clients.
- Do NOT redesign unrelated payment/voucher behavior.
- STOP on drift from commit `b94c4ae`; report it.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` introduces no diagnostic and does not lower the score.
  - `bunx tsc --noEmit`
  - `bun run lint`
  - Focused tests: `bun run test:run -- app/api/scalev/create-payment/route.test.ts app/api/orders/public-status/route.test.ts app/checkout/success/page.test.tsx app/checkout/[id]/checkout-page-client.test.tsx app/checkout/cart/cart-checkout-client.test.tsx`
  - Full tests: `bun run test:run`
- **Behavior check**: Complete single/cart checkout and verify pending polling, completion/voucher download, failure, popup fallback, refresh during the session, and Indonesian expiry state.
- **Security check**: Inspect URL/history/network/console/storage/logs for token absence. Reject missing, expired, modified, and cross-order cookies with no PII. Verify no third-party request on `/checkout/**`, status, review/verify, auth, or admin; verify the approved marketing pixel still loads on `/`.
- **Done when**: no durable capability crosses the browser boundary, status uses a short-lived secure order-bound session, sensitive routes have zero third-party scripts/beacons, and all checks pass.

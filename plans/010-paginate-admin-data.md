# 010 — Paginate and filter admin data on the server

- **Status**: OPEN
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 11–14 files including migration/tests; broad admin data-flow refactor

## Problem

Admin list actions retrieve complete broad datasets and serialize them through RSC:

```ts
// lib/actions/orders.ts:154-169 — current
export async function getOrders(): Promise<OrderWithVoucherItems[]> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_ADMIN_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (data as OrderWithVoucherItems[]) || [];
}
```

```ts
// lib/actions/vouchers.ts:127-141 — current
export async function getVouchers(): Promise<VoucherWithService[]> {
  await requireAdminPermission(AdminPermission.VOUCHERS_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select(`*, services(*)`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vouchers:", error);
    return [];
  }

  return (data as VoucherWithService[]) || [];
}
```

```ts
// lib/actions/reviews.ts:81-95 — current
export async function getAdminReviews(): Promise<Review[]> {
  await requireAdminPermission(AdminPermission.REVIEWS_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin reviews:", error);
    return [];
  }

  return (data as Review[]) || [];
}
```

Pages pass those arrays directly (`app/admin/(protected)/purchases/page.tsx:9-24`, `vouchers/page.tsx:5-9`, `reviews/page.tsx:5-9`). Every keystroke then scans the transferred array:

```tsx
// components/admin/purchases-client.tsx:151-162 — current
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_email.toLowerCase().includes(searchLower) ||
      order.payment_order_id?.toLowerCase().includes(searchLower) ||
      getOrderServiceSummary(order).toLowerCase().includes(searchLower) ||
      order.payment_transaction_id?.toLowerCase().includes(searchLower);
    const matchesStatus =
      statusFilter === "ALL" || order.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });
```

```tsx
// components/admin/vouchers-client.tsx:162-173 — current
  const filteredVouchers = vouchers.filter((voucher) => {
    const status = getVoucherStatus(voucher);
    const matchesSearch =
      voucher.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voucher.recipient_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      voucher.recipient_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });
```

```tsx
// components/admin/reviews-client.tsx:34-40 — current
  const filteredReviews = reviews.filter((review) => {
    const matchesSearch = 
      review.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (review.comment && review.comment.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRating = ratingFilter === "ALL" || review.rating.toString() === ratingFilter;
    return matchesSearch && matchesRating;
  });
```

The dashboard similarly fetches full order/voucher/review rows and aggregates in JavaScript:

```ts
// lib/actions/dashboard.ts:77-109 — current
  const supabase = getAdminClient();
  const ordersPromise = canViewBusinessMetrics
    ? supabase
        .from("orders")
        .select(
          "id, customer_name, total_amount, created_at, payment_status, vouchers:vouchers!orders_voucher_id_fkey(services(name, duration))"
        )
        .order("created_at", { ascending: false })
    : supabase
        .from("orders")
        .select(
          "id, customer_name, created_at, payment_status, vouchers:vouchers!orders_voucher_id_fkey(services(name, duration))"
        )
        .order("created_at", { ascending: false });
  const servicesPromise = canViewBusinessMetrics
    ? supabase.from("services").select("id", { count: "exact" })
    : Promise.resolve({ data: [], count: 0, error: null });
  const reviewsPromise = canManageReviews
    ? supabase.from("reviews").select("*").order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  // Parallel queries for better performance
  const [
    servicesResult,
    vouchersResult,
    ordersResult,
    reviewsResult,
  ] = await Promise.all([
    servicesPromise,
    supabase.from("vouchers").select("*, services(name, duration)"),
    ordersPromise,
    reviewsPromise,
  ]);
```

```ts
// lib/actions/dashboard.ts:123-160 — current
  const now = new Date();
  const activeVouchers = vouchers.filter(
    (v) => !v.is_redeemed && new Date(v.expiry_date) > now
  ).length;
  const redeemedVouchers = vouchers.filter((v) => v.is_redeemed).length;
  const expiredVouchers = vouchers.filter(
    (v) => !v.is_redeemed && new Date(v.expiry_date) <= now
  ).length;

  // Calculate total revenue
  const totalRevenue = canViewBusinessMetrics
    ? completedBusinessOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    : 0;

  // Calculate average rating
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  // Generate revenue data for last 7 days
  const revenueData = canViewBusinessMetrics
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayOrders = completedBusinessOrders.filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === date.toDateString();
        });
        return {
          day: date.toLocaleDateString("en-US", { weekday: "short" }),
          revenue: dayOrders.reduce(
            (sum, order) => sum + (order.total_amount || 0),
            0
          ),
          orders: dayOrders.length,
        };
      })
    : [];
```

## Target

Use URL-backed range pagination (`PAGE_SIZE = 25`), narrow selects, database filters/counts, and deterministic `(created_at DESC, id DESC)` ordering.

```ts
// lib/actions/admin-pagination.ts — target
export const ADMIN_PAGE_SIZE = 25;
export interface AdminListParams {
  page: number;
  query: string;
  filter: string;
}
export interface AdminPage<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export function normalizeAdminListParams(input: {
  page?: string; query?: string; filter?: string;
}): AdminListParams {
  const page = Number.parseInt(input.page ?? "1", 10);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    query: (input.query ?? "").trim().slice(0, 100),
    filter: (input.filter ?? "ALL").toUpperCase(),
  };
}
```

```ts
// lib/actions/orders.ts — target query shape
export async function getOrdersPage(
  params: AdminListParams
): Promise<AdminPage<OrderWithVoucherItems>> {
  await requireAdminPermission(AdminPermission.ORDERS_VIEW);
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;
  let request = getAdminClient()
    .from("orders")
    .select(ORDER_ADMIN_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (params.filter !== "ALL") {
    request = request.eq("payment_status", params.filter);
  }
  if (params.query) {
    const pattern = `%${escapePostgrestLike(params.query)}%`;
    request = request.or(
      `customer_name.ilike.${pattern},customer_email.ilike.${pattern},payment_order_id.ilike.${pattern},payment_transaction_id.ilike.${pattern}`
    );
  }
  const { data, count, error } = await request.range(
    from,
    from + ADMIN_PAGE_SIZE - 1
  );
  if (error) throw error;
  const totalCount = count ?? 0;
  return {
    rows: (data as OrderWithVoucherItems[]) ?? [],
    page: params.page,
    pageSize: ADMIN_PAGE_SIZE,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
  };
}
```

`escapePostgrestLike` must escape `%`, `_`, comma, parentheses, and backslash. Apply equivalent queries to vouchers (code/name/email plus ACTIVE/REDEEMED/EXPIRED database predicates) and reviews (customer/comment plus validated rating 1–5). Select only fields displayed or needed by existing actions/dialogs.

```tsx
// app/admin/(protected)/reviews/page.tsx — target
interface AdminReviewsPageProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    rating?: string;
  }>;
}
export default async function AdminReviewsPage({
  searchParams,
}: AdminReviewsPageProps) {
  await requireAdminRouteAccess("/admin/reviews");
  const raw = await searchParams;
  const reviewsPage = await getAdminReviewsPage(
    normalizeAdminListParams({
      page: raw.page,
      query: raw.query,
      filter: raw.rating,
    })
  );
  return <ReviewsClient initialPage={reviewsPage} />;
}
```

Use `status` for purchases/vouchers and `rating` for reviews. Debounce URL search writes by 300 ms, reset `page` on query/filter changes, and navigate with `router.replace(..., { scroll: false })`. Render `initialPage.rows`, not a complete client-filtered array; successful mutations call `router.refresh()`. Add Previous/Next controls, total count, and page X/Y.

For dashboard, add `lib/supabase/migrations/020_add_admin_dashboard_aggregates.sql` with a `SECURITY INVOKER` aggregate RPC (fixed typed output for totals plus seven daily completed-order buckets). It must not alter grants, roles, or RLS. Keep the same permission branches in `getDashboardStats`; fetch recent orders with `.limit(5)`, recent reviews with `.limit(3)`, and service counts with `{ count: "exact", head: true }`.

Existing relevant indexes include:

```sql
-- lib/supabase/migrations/001_initial_schema.sql:135-145 — current
CREATE INDEX idx_orders_voucher_id ON orders(voucher_id);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

```sql
-- lib/supabase/migrations/001_initial_schema.sql:92-105 — current
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_service_id ON vouchers(service_id);
CREATE INDEX idx_vouchers_is_redeemed ON vouchers(is_redeemed);
CREATE INDEX idx_vouchers_expiry_date ON vouchers(expiry_date);
CREATE INDEX idx_vouchers_recipient_email ON vouchers(recipient_email);
```

```sql
-- lib/supabase/migrations/001_initial_schema.sql:163-170 — current
CREATE INDEX idx_reviews_voucher_id ON reviews(voucher_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE UNIQUE INDEX idx_reviews_unique_voucher ON reviews(voucher_id);
```

Verify with `EXPLAIN (ANALYZE, BUFFERS)` before adding indexes. Candidates are composite filter/order indexes and trigram substring-search indexes; add only measured improvements. Verify `pg_trgm` availability before relying on it.

## Repo conventions to follow

- Retain `requireAdminRouteAccess` and each current `requireAdminPermission`.
- Imitate the exact head count at `lib/actions/admin-users.ts:38-41`.
- Use Next.js 16 async `searchParams`, absolute imports, and current mutation/dialog patterns.

## Steps

1. Add pagination contracts, validation, and safe PostgREST LIKE escaping with tests.
2. Replace the three broad list reads with narrow, exact-count, filtered, ordered `.range()` actions.
3. Parse URL params in the three protected pages and pass `AdminPage<T>`.
4. Make all three clients URL-backed with 300 ms search debounce, page reset on filter/search, and pagination controls.
5. Keep optimistic state limited to visible rows; refresh after mutation and handle an emptied last page.
6. Add a `SECURITY INVOKER` dashboard aggregate migration without permission changes; replace broad dashboard reads with aggregate/count/limit queries.
7. Verify representative plans and add only justified indexes.
8. Test counts, filters, escaped search, tied timestamps, page boundaries, empty data, mutations, and permission parity.
9. Re-read the diff and remove unrelated churn.

## Boundaries

- Do NOT alter RLS, grants, roles, route access, or action permission checks.
- Do NOT expose service-role access or query admin data from the browser.
- Do NOT retain unpaginated fallbacks or filter records outside the current page in clients.
- Do NOT interpolate raw search text.
- Do NOT add indexes/extensions without measured evidence.
- Do NOT change mutation semantics, audit logs, or dashboard metric definitions.
- Do NOT add dependencies.
- STOP on drift from `b94c4ae`; report it instead of improvising.

## Verification

- **Mechanical**:
  - Apply migration twice in disposable/staging Supabase; run `bunx tsc --noEmit`, `bun run lint`, focused/full tests.
  - Run `npx react-doctor@latest --scope changed`; score must not regress, then run an unfiltered affected-scope scan.
  - Confirm RSC payloads contain at most 25 list rows, 5 recent orders, and 3 recent reviews.
  - Compare `EXPLAIN (ANALYZE, BUFFERS)` before/after and verify grants/RLS/permissions are unchanged.
- **Behavior check**:
  - Rapidly type searches; confirm one navigation after 300 ms, database matches, URL restoration with back/forward, and page reset.
  - Traverse first/middle/last pages without gaps/duplicates; test existing mutations including the last row on the last page.
  - Compare all dashboard metrics against direct SQL under roles with and without business/review permission.
  - Profile 10-character searches before/after. Confirm full-list filter commits disappear and only the input updates before navigation; with “Highlight updates,” the table/grid must not flash on every keypress.
- **Done when**: payloads are bounded, filtering/counting is database-backed, URLs own list state, dashboard broad reads are gone, permissions are unchanged, and checks/Profiler pass.

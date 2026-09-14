# 007 — Scope navbar data work to public pages

- **Status**: OPEN
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 10–12 files, route moves plus one cached query/tests

## Problem

`app/layout.tsx:85-103` performs three `site_settings` queries from the root:

```tsx
async function NavbarWithAnnouncement() {
  const [announcementSetting, countdownEndAtSetting, countdownEnabledSetting] =
    await Promise.all([
      getSiteSetting("announcement_text"),
      getSiteSetting("announcement_countdown_end_at"),
      getSiteSetting("announcement_countdown_enabled"),
    ]);
  const announcementText =
    announcementSetting?.value || "FLASH SALE 5.5 ...... BERAKHIR DALAM ";

  return (
    <Navbar
      announcementText={announcementText}
      announcementCountdownEndAt={countdownEndAtSetting?.value || undefined}
      announcementCountdownEnabled={isAnnouncementCountdownEnabled(
        countdownEnabledSetting?.value
      )}
    />
  );
}
```

`app/layout.tsx:120-124` mounts it for every route:

```tsx
<ToastProvider>
  <Suspense fallback={null}>
    <NavbarWithAnnouncement />
  </Suspense>
  <main>{children}</main>
</ToastProvider>
```

Only after this server/data work does `components/navbar.tsx:38,58-65` hide client-side:

```tsx
const pathname = usePathname();

if (
  pathname.startsWith("/checkout") ||
  pathname.startsWith("/voucher") ||
  pathname.startsWith("/admin")
) {
  return null;
}
```

The generic read at `lib/actions/crm.ts:91-97` also selects every column:

```ts
const { data, error } = await supabase
  .from("site_settings")
  .select("*")
  .eq("key", key)
  .maybeSingle();
```

Checkout, voucher, and admin requests therefore pay three DB queries and navbar render/client work for UI that returns `null`.

## Target

Root owns only global document/providers. A `(public)` route-group layout owns navbar-bearing `/`, `/verify`, and `/review/[id]`. Checkout, voucher, admin, and auth remain outside and do no navbar/settings work.

```tsx
// app/layout.tsx — target relevant body
<MetaPixel />
<ToastProvider>
  <main>{children}</main>
</ToastProvider>
```

Preserve provider wrappers owned by plans 006/008 if those plans have not run.

Add one request-independent cached query with specific columns:

```ts
// lib/actions/crm.ts — target
import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";

export const ANNOUNCEMENT_SETTINGS_CACHE_TAG = "site-settings:announcement";
const ANNOUNCEMENT_SETTING_KEYS = [
  "announcement_text",
  "announcement_countdown_end_at",
  "announcement_countdown_enabled",
] as const;

export interface AnnouncementSettings {
  announcementText?: string;
  countdownEndAt?: string;
  countdownEnabled?: string;
}

export async function getAnnouncementSettings(): Promise<AnnouncementSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(ANNOUNCEMENT_SETTINGS_CACHE_TAG);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [...ANNOUNCEMENT_SETTING_KEYS]);

  if (error) {
    console.error("Error fetching announcement settings:", error);
    return {};
  }

  const values = new Map(data.map(({ key, value }) => [key, value]));
  return {
    announcementText: values.get("announcement_text"),
    countdownEndAt: values.get("announcement_countdown_end_at"),
    countdownEnabled: values.get("announcement_countdown_enabled"),
  };
}
```

`getAdminClient()` avoids request cookies inside `"use cache"`; only the three public values leave this server-only function. Make CRM mutations invalidate this exact tag:

```ts
// lib/actions/crm.ts — target
function revalidateCmsPaths() {
  revalidateTag(ANNOUNCEMENT_SETTINGS_CACHE_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/", "page");
  revalidatePath("/admin/crm", "page");
}
```

```tsx
// app/(public)/layout.tsx — target
import { Suspense } from "react";
import Navbar from "@/components/navbar";
import { getAnnouncementSettings } from "@/lib/actions/crm";
import { isAnnouncementCountdownEnabled } from "@/lib/site-settings";

async function PublicNavbar() {
  const settings = await getAnnouncementSettings();
  return (
    <Navbar
      announcementText={
        settings.announcementText || "FLASH SALE 5.5 ...... BERAKHIR DALAM "
      }
      announcementCountdownEndAt={settings.countdownEndAt || undefined}
      announcementCountdownEnabled={isAnnouncementCountdownEnabled(
        settings.countdownEnabled
      )}
    />
  );
}

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <PublicNavbar />
      </Suspense>
      {children}
    </>
  );
}
```

Move without changing URLs:

```text
app/page.tsx       -> app/(public)/page.tsx
app/verify/**      -> app/(public)/verify/**
app/review/**      -> app/(public)/review/**
```

Update moved internal/test aliases to `@/app/(public)/...`. Remove `usePathname`, `pathname`, and the route early return from `components/navbar.tsx`; route ownership is the only gate.

## Repo conventions to follow

- Imitate cache directives/tags at `lib/actions/dashboard.ts:60-65`, using shared `"use cache"` rather than private cache.
- Imitate mutation invalidation at `lib/actions/services.ts:75-80` and preserve CRM paths at `lib/actions/crm.ts:31-35`.
- Follow server layout ownership at `app/admin/(protected)/layout.tsx:6-28`.
- Reuse boolean parsing at `lib/site-settings.ts:1-10`.
- Preserve App Router URLs; route-group parentheses are filesystem-only.

## Steps

1. Add `ANNOUNCEMENT_SETTINGS_CACHE_TAG` and exact one-query `getAnnouncementSettings` to `lib/actions/crm.ts`.
2. Add matching `revalidateTag(..., "max")` to `revalidateCmsPaths`, preserving all path invalidation.
3. Extend `lib/actions/__tests__/crm.test.ts`: assert one query, `.select("key, value")`, one `.in(...)` with three keys, cache tag, row-order-independent mapping, `{}` on error, and update/delete invalidation.
4. Add `app/(public)/layout.tsx` with the target Suspense/PublicNavbar code.
5. Move root page and complete verify/review trees under `(public)`; update all `@/app/verify` and `@/app/review` aliases/tests.
6. Remove Navbar/Suspense/settings imports, `NavbarWithAnnouncement`, and navbar rendering from root only.
7. Remove pathname hiding from `components/navbar.tsx`.
8. Add layout/module tests proving one settings call on public layout and none from excluded route trees.
9. Check route manifest and remove unrelated churn.

## Boundaries

- Do NOT change URLs, params, metadata, page behavior, or move checkout/voucher/admin/auth into the navbar group.
- Do NOT retain client pathname hiding as fallback.
- Do NOT cache cookies/user data; query only `"key, value"` and three announcement keys.
- Do NOT change hero setting, testimonial, service, or admin CRM reads.
- Do NOT remove existing CRM path invalidation.
- Do NOT add dependencies or another settings cache.
- Preserve provider changes owned by plans 006/008; never reintroduce removed providers.
- STOP if routes/layouts drifted from commit `b94c4ae`.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not regress the score.
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run test:run -- lib/actions/__tests__/crm.test.ts 'app/(public)/verify/verify-page-client.test.tsx' 'app/(public)/review/[id]/review-page-client.test.tsx'`
  - `bun run build` confirms no duplicate routes and preserves `/`, `/verify`, `/review/[id]`.
- **Behavior check**: Verify navbar on `/`, `/verify`, `/review/[id]`; verify none on checkout, voucher, admin, auth. Server tracing must show no announcement query on excluded requests. Update CRM announcement fields and confirm tag invalidation updates the next public render.
- **Profiler check**: Profile navigation to/between excluded routes with “Highlight updates”; `Navbar` must be absent and never flash. DB tracing must show one query on cache miss and zero on hit, replacing three queries.
- **Done when**: server route ownership excludes navbar work, one narrow cached query feeds public navbar, CRM invalidates its tag, URLs/behavior remain stable, and Doctor/typecheck/lint/tests/Profiler checks pass.

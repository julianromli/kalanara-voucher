# 006 — Remove the unused global store

- **Status**: DONE
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: Beyond the scan
- **Estimated scope**: 2 runtime files, one provider removal and one dead-file deletion

## Problem

`app/layout.tsx:7-10` imports the legacy global store, and `app/layout.tsx:117-127` mounts it on every route:

```tsx
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import { getSiteSetting } from "@/lib/actions/crm";

// ...
<MetaPixel />
<AuthProvider>
  <StoreProvider>
    <ToastProvider>
      <Suspense fallback={null}>
        <NavbarWithAnnouncement />
      </Suspense>
      <main>{children}</main>
    </ToastProvider>
  </StoreProvider>
</AuthProvider>
```

`context/StoreContext.tsx:188-243` allocates all store state and loads all services/reviews on mount:

```tsx
export function StoreProvider({ children }: StoreProviderProps) {
  const [services, setServices] = useState<FrontendService[]>([]);
  const [vouchers, setVouchers] = useState<FrontendVoucher[]>([]);
  const [orders, setOrders] = useState<FrontendOrder[]>([]);
  const [reviews, setReviews] = useState<FrontendReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fetchDataFromSupabase = useCallback(async () => {
    const [dbServices, dbReviews] = await Promise.all([
      getServices(),
      getReviews(),
    ]);
    // ...
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(frontendServices));
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(frontendReviews));
  }, []);

  useEffect(() => {
    fetchDataFromSupabase();
  }, [fetchDataFromSupabase]);
```

It installs a global storage listener at `context/StoreContext.tsx:245-264`:

```tsx
useEffect(() => {
  function handleStorageChange(event: StorageEvent) {
    // updates services, vouchers, orders, and reviews
  }
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

At commit `b94c4ae`, production `rg` finds no `useStore()` consumer outside `context/StoreContext.tsx`; the only provider import is root layout. References under `docs/vite/**` and `tasks/**` are archived/historical, not production consumers. The provider therefore ships client code, two requests, localStorage work, a listener, and provider rerenders without serving runtime behavior.

Public services/reviews already have server ownership at `app/page.tsx:40-47`:

```tsx
export default async function LandingPage() {
  const [dbServices, heroImageSetting, activeTestimonials] = await Promise.all([
    getServices(),
    getSiteSetting("hero_image_url"),
    getActiveTestimonials(),
  ]);
```

## Target

After proving there is no production import, remove the provider and delete its runtime file:

```tsx
// app/layout.tsx — target provider shape after plans 006 and 008
<MetaPixel />
<ToastProvider>
  <Suspense fallback={null}>
    <NavbarWithAnnouncement />
  </Suspense>
  <main>{children}</main>
</ToastProvider>
```

If plan 008 has not run, remove only `StoreProvider` and preserve the current auth wrapper. If plan 007 has run, preserve its route-scoped navbar structure.

```text
context/StoreContext.tsx   deleted
app/layout.tsx             no StoreProvider import or wrapper
app/page.tsx               server getServices/getActiveTestimonials unchanged
docs/vite/**, tasks/**      unchanged
```

## Repo conventions to follow

- Unwrap only one provider using the nesting style at `app/layout.tsx:117-127`.
- Preserve server-owned public loading at `app/page.tsx:40-47`.
- Treat `docs/vite/App.tsx:26-45` and `docs/vite/context/StoreContext.tsx:1-275` as a separate reference app.
- Use existing scripts at `package.json:6-11`.

## Steps

1. Run this exact production-only check:

   ```bash
   rg -n 'StoreProvider|useStore|@/context/StoreContext' app components context hooks lib store \
     --glob '*.{ts,tsx}'
   ```

   Expected matches are only `app/layout.tsx` and declarations inside `context/StoreContext.tsx`. STOP and report any other production consumer.
2. Remove the `StoreProvider` import at `app/layout.tsx:9`.
3. Remove only `<StoreProvider>`/`</StoreProvider>` at `app/layout.tsx:119,126`, preserving children and ordering.
4. Delete `context/StoreContext.tsx`.
5. Re-run the check and require zero production matches.
6. Confirm the landing page still directly calls `getServices`, `getSiteSetting("hero_image_url")`, and `getActiveTestimonials`; introduce no replacement fetch.
7. Remove unrelated diff churn.

## Boundaries

- Do NOT edit `docs/vite/**`, `tasks/**`, AGENTS files, or historical/reference code.
- Do NOT alter service, review, hero, checkout, voucher, review, or admin fetching/behavior.
- Do NOT add a replacement context, Zustand store, prop chain, or client fetch.
- Do NOT remove ToastProvider, MetaPixel, `<main>`, metadata, fonts, or navbar ownership.
- Auth/navbar placement belongs to plans 008/007; preserve their then-current structures and never reintroduce removed providers.
- Do NOT add dependencies.
- STOP if production import evidence differs from commit `b94c4ae`.

## Verification

- **Mechanical**:
  - The production `rg` check returns no matches.
  - `npx react-doctor@latest --scope changed` does not regress the score (Beyond-scan finding).
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run test:run`
- **Behavior check**: Open `/`, a valid checkout, `/verify`, and `/admin/login`. Confirm catalog services/reviews remain database-backed, all routes work, there is no missing-provider error, and Network DevTools shows no StoreContext client `getServices`/`getReviews` work.
- **Profiler check**: Profile a cold `/` load before/after. Confirm `StoreProvider` is absent, no global-store hydration commit rerenders the root subtree, and “Highlight updates” no longer flashes the app when legacy service/review loading resolves.
- **Done when**: the unused runtime context is deleted, public server fetch behavior is unchanged, no production imports remain, and Doctor/typecheck/lint/tests/behavior/Profiler checks pass.

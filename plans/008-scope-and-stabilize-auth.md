# 008 — Scope and stabilize admin authentication

- **Status**: DONE
- **Commit**: b94c4ae
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 5 runtime/test files, provider ownership plus async race tests

## Problem

`app/layout.tsx:7-9,117-127` mounts `AuthProvider` around every route:

```tsx
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";

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

Protected admin routes then mount a second provider at `app/admin/(protected)/layout.tsx:6-28`:

```tsx
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getCurrentAdminAccess();

  if (!access) {
    redirect("/admin/login?error=unauthorized");
  }

  const bootstrapUser: User = {
    id: access.userId,
    email: access.email,
    name: access.name,
    role: access.role,
  };

  return (
    <AuthProvider bootstrapUser={bootstrapUser}>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
```

The outer provider performs Supabase browser auth setup on public pages that never consume auth. At commit `b94c4ae`, production `useAuth` imports are only in `app/admin/login/page.tsx` and `components/admin/**`; there is no production public `useAuth` in `app/page.tsx`, checkout, voucher, verify, review, auth/set-password, or public components. Matches under `docs/vite/**` are an archived reference app, not production use.

The provider also has a last-completion-wins race. `context/AuthContext.tsx:129-186` starts session bootstrap and an async auth listener independently:

```tsx
useEffect(() => {
  // ...
  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const resolvedUser = await extractUserFromSupabaseUser(supabase, session.user);
        setUser(resolvedUser ?? bootstrapUserRef.current);
      } else if (!hasBootstrapUser) {
        setUser(null);
      }
    } catch (error) {
      // ...
    } finally {
      setIsLoading(false);
    }
  };

  initializeAuth();

  let subscription: { unsubscribe: () => void } | null = null;
  try {
    const { data } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser((await extractUserFromSupabaseUser(supabase, session.user)) ?? bootstrapUserRef.current);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser((await extractUserFromSupabaseUser(supabase, session.user)) ?? bootstrapUserRef.current);
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser((await extractUserFromSupabaseUser(supabase, session.user)) ?? bootstrapUserRef.current);
        }
      }
    );
```

If `SIGNED_OUT` occurs while `getSession()` or an admin-row lookup is pending, the older async bootstrap can later restore a user. Two user-bearing auth events can likewise resolve out of order, allowing stale identity/role data to overwrite the latest event. Cleanup unsubscribes but does not prevent an already-running callback from setting state after unmount.

## Target

Mount auth exactly once, and only in the admin branch:

```tsx
// app/layout.tsx — target auth ownership
// no AuthProvider import
// no <AuthProvider> wrapper
```

Keep the existing protected provider because it carries a server-authorized bootstrap user. Add a sibling owner for login:

```tsx
// app/admin/login/layout.tsx — target
import { AuthProvider } from "@/context/AuthContext";

export default function AdminLoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

The route tree is then:

```text
/admin/login               app/admin/login/layout.tsx -> one AuthProvider
/admin/(protected)/**      app/admin/(protected)/layout.tsx -> one AuthProvider with bootstrapUser
all non-admin routes       no AuthProvider
```

Do not move the provider to `app/admin/layout.tsx`: doing so would either recreate nesting or lose the protected layout’s server-derived `bootstrapUser`. `app/admin/layout.tsx:1-16` remains the shared `ThemeProvider` only.

Preserve server authorization exactly:

```tsx
// app/admin/(protected)/layout.tsx — remains the authority
const access = await getCurrentAdminAccess();
if (!access) {
  redirect("/admin/login?error=unauthorized");
}
```

Add a monotonic generation guard around every effect-owned async resolution:

```tsx
// context/AuthContext.tsx — target race-control shape
const authGenerationRef = useRef(0);

useEffect(() => {
  let active = true;

  const isCurrent = (generation: number) =>
    active && generation === authGenerationRef.current;

  const resolveForGeneration = async (
    supabaseUser: SupabaseUser,
    generation: number
  ) => {
    const resolvedUser = await extractUserFromSupabaseUser(supabase, supabaseUser);
    if (!isCurrent(generation)) return;
    setUser(resolvedUser ?? bootstrapUserRef.current);
  };

  const initializeAuth = async () => {
    const generation = ++authGenerationRef.current;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isCurrent(generation)) return;
      if (session?.user) {
        await resolveForGeneration(session.user, generation);
      } else if (!hasBootstrapUser) {
        setUser(null);
      }
    } catch (error) {
      if (!isCurrent(generation)) return;
      console.error("Error initializing auth:", error);
      if (!hasBootstrapUser) setUser(null);
    } finally {
      if (isCurrent(generation)) setIsLoading(false);
    }
  };

  void initializeAuth();

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const generation = ++authGenerationRef.current;

    if (event === "SIGNED_OUT") {
      if (isCurrent(generation)) {
        setUser(null);
        setIsLoading(false);
      }
      return;
    }

    if (
      (event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED") &&
      session?.user
    ) {
      void resolveForGeneration(session.user, generation);
    }
  });

  return () => {
    active = false;
    authGenerationRef.current += 1;
    data.subscription.unsubscribe();
  };
}, [hasBootstrapUser, supabase]);
```

Retain the existing listener setup error handling if `onAuthStateChange` can throw; in that case use the current nullable `subscription` variable, but keep the same generation invalidation and `active` guard. The key invariant is that every bootstrap/event starts a newer generation before awaiting, and only the current active generation may call `setUser` or `setIsLoading`.

`login` and `logout` must also invalidate older effect work before committing direct state:

```tsx
// context/AuthContext.tsx — target invariant inside login/logout
const generation = ++authGenerationRef.current;
// await auth/admin resolution
if (generation !== authGenerationRef.current) {
  return a result consistent with the newer auth event without setting stale state;
}
```

For logout, increment before `signOut()` and only clear state for the current generation; the `SIGNED_OUT` listener may advance the generation and perform the clear itself. Do not allow an older login/admin lookup to restore the user after logout.

## Repo conventions to follow

- Preserve server-side access enforcement and bootstrap mapping in `app/admin/(protected)/layout.tsx:10-27`.
- Preserve the simple provider layout style in `app/admin/layout.tsx:3-16`, but keep auth in branch-specific layouts.
- Extend the existing Testing Library/Vitest harness in `context/AuthContext.test.tsx:1-91`; use deferred promises and the captured `onAuthStateChange` callback rather than timers.
- Preserve role normalization and admin-table resolution in `context/AuthContext.tsx:56-89`.
- Preserve `useAuth`’s missing-provider error at `context/AuthContext.tsx:259-264`.

## Steps

1. Run a production-only search:

   ```bash
   rg -n 'useAuth|AuthProvider|@/context/AuthContext' app components context hooks lib store \
     --glob '*.{ts,tsx}'
   ```

   Confirm all consumers are admin-owned except the root provider declaration/import. Ignore `docs/vite/**`; STOP and report drift if a real public runtime consumer exists.
2. Remove the root `AuthProvider` import and wrapper from `app/layout.tsx`, preserving all unrelated providers and layout content.
3. Add `app/admin/login/layout.tsx` with exactly one non-bootstrap `AuthProvider`.
4. Keep `app/admin/(protected)/layout.tsx` as the sole provider for protected routes and preserve `getCurrentAdminAccess`, redirect, and `bootstrapUser`.
5. Do not add `AuthProvider` to `app/admin/layout.tsx`; verify login and protected layouts cannot nest with each other.
6. In `context/AuthContext.tsx`, add the generation/active guard to initial session resolution and all auth event resolutions. Invalidate pending work during cleanup.
7. Apply the same generation invariant to `login` and `logout`, including the case where Supabase emits an auth event while their awaited work is still pending. Keep existing Indonesian access-denied text and return contracts.
8. Expand `context/AuthContext.test.tsx` with deterministic deferred-promise tests:
   - a late bootstrap session/admin lookup cannot overwrite a newer `SIGNED_OUT`;
   - the latest of two user-bearing events wins when admin lookups resolve in reverse order;
   - an unmounted provider ignores pending bootstrap/event completion;
   - bootstrap user renders immediately in protected mode;
   - login remains available under the login layout and logout cannot be undone by a late login resolution.
9. Add lightweight layout tests or static import assertions proving public/root has no AuthProvider, login has one, protected has one with bootstrap, and `getCurrentAdminAccess` still redirects unauthorized requests.
10. Re-run the production search and verify no non-admin runtime consumer/provider remains. Re-read the diff and remove unrelated churn.

## Boundaries

- Do NOT weaken, remove, or replace `getCurrentAdminAccess()` and its protected-layout redirect. Client context is presentation/state, not authorization.
- Do NOT mount `AuthProvider` globally or in both `app/admin/layout.tsx` and a child layout.
- Do NOT remove auth from `/admin/login`; login must remain able to call `useAuth`.
- Do NOT add auth to public routes merely because archived `docs/vite/**` files use it. There is no production public `useAuth` at commit `b94c4ae`.
- Do NOT change admin permissions, role normalization, login error messages, redirect destinations, Supabase configuration, or cookie/middleware behavior.
- Do NOT solve races with arbitrary delays, debouncing, or an `isMounted` boolean alone; use a monotonic generation so stale-but-mounted resolutions are rejected.
- Do NOT add dependencies.
- Coordinate with plans 006 and 007 by preserving their then-current provider/navbar structure; remove only auth ownership from root.
- STOP if auth consumers or route ownership have drifted from commit `b94c4ae`; report the drift instead of improvising.

## Verification

- **Mechanical**:
  - Run `npx react-doctor@latest --scope changed`; the score must not regress (this is a Beyond-the-scan finding).
  - Run `bunx tsc --noEmit`.
  - Run `bun run lint`.
  - Run `bun run test:run -- context/AuthContext.test.tsx` plus any new admin layout test.
  - Run the production-only `rg` command and confirm all `useAuth` consumers and provider mounts are under admin ownership; `context/AuthContext.tsx` itself is the only non-admin definition.
- **Behavior check**: As a signed-out visitor, load `/`, checkout, voucher, verify, and review pages and confirm no Supabase browser auth bootstrap/admin lookup runs. Load `/admin/login`, sign in, and confirm redirect/state behavior. Load a protected admin URL signed out and confirm the server redirects to `/admin/login?error=unauthorized`; signed in, confirm header identity, permissions, and logout still work. Throttle the admin-row request, sign out before it resolves, then confirm the UI stays signed out.
- **Profiler check**: Record cold public and protected-admin loads with React DevTools Profiler and “Highlight updates.” Confirm public trees contain no `AuthProvider` and have no auth-driven commit; each admin branch contains exactly one provider. During a forced reverse-resolution test, confirm stale completion causes no user-state rerender.
- **Done when**: auth mounts exactly once per admin route and nowhere public, server authorization is unchanged, stale async work cannot win or update after unmount, no production public `useAuth` exists, and Doctor/typecheck/lint/focused tests/behavior/Profiler checks pass.

# Admin Sidebar Instant Navigation Design

Date: 2026-05-05
Status: Approved for specification
Scope: Admin sidebar route navigation only (`/admin/dashboard`, `/admin/services`, `/admin/purchases`, etc.)

## Summary

Improve the admin dashboard route transition UX so a sidebar click feels immediate.

Target behavior:
- The clicked sidebar item becomes active immediately.
- The main content area switches to a loading skeleton immediately.
- The admin shell (sidebar + frame) stays visible and interactive.
- The destination page data can continue loading in the background.
- The routing architecture remains route-per-page in Next.js App Router.

This work is intentionally limited to admin sidebar route transitions. It does not change local in-page tabs such as the Settings page tab UI.

## Problem Statement

Today, admin route changes feel delayed because the visual active state and content transition are coupled to route completion.

Observed causes in the current codebase:
1. `components/admin/sidebar.tsx` derives active state from `usePathname()`, so the active menu highlight updates only after navigation commits.
2. `app/admin/(protected)/layout.tsx` performs server-side access resolution before rendering the protected subtree, which can delay visible transition behavior.
3. Several admin pages still block on server data before rendering their page content.
4. Loading skeleton coverage exists for some admin pages, but there is no shared protected-route loading boundary coordinating the whole content pane transition.

The user-visible result is: clicking a sidebar item can feel like the UI is waiting for the response before the tab “actually changes”.

## Goals

- Make sidebar navigation feel instant.
- Show immediate feedback on click, even when the destination page is slow.
- Preserve current route URLs and App Router structure.
- Keep authorization and route protections intact.
- Ensure final active state always matches the actual route after navigation settles.

## Non-Goals

- Rebuild the admin area as a single-page client-side tab container.
- Change the Settings page local tab behavior.
- Remove server-side auth checks.
- Fully redesign admin loading UIs.
- Broadly refactor unrelated admin code.

## Recommended Approach

### 1. Optimistic sidebar active state

Add a temporary client-side active state in `components/admin/sidebar.tsx`.

Behavior:
- On click, immediately mark the clicked route as active.
- Continue using Next route navigation as normal.
- When `pathname` updates, reconcile the optimistic state back to the real route.
- If navigation redirects or fails, the sidebar falls back to the committed `pathname`.

Why:
- This decouples visual responsiveness from server response time.
- The user sees the navigation intent acknowledged immediately.

### 2. Shared loading boundary for protected admin routes

Add a shared loading boundary at:
- `app/admin/(protected)/loading.tsx`

Behavior:
- On navigation between protected admin sibling routes, the content pane shows fallback UI immediately.
- The persistent admin shell remains mounted.
- The loading boundary should focus on the right-side content area rather than replacing the whole admin viewport.

Why:
- This matches the intended App Router model: shared layout stays interactive while the next segment loads.
- It makes the route transition feel immediate even when the page data is still pending.

### 3. Route-specific loading skeleton coverage

Keep or refine page-specific loading UIs where they improve fidelity.

Current coverage appears to exist for:
- services
- purchases
- reviews
- users
- vouchers
- settings
- help

Likely additions or alignment needed for:
- dashboard
- crm
- discount-codes

Implementation note:
- Loading file placement must be validated against the active App Router branch structure so the fallback applies to the protected admin route segment as intended.

Design rule:
- Shared protected loading provides immediate fallback.
- Route-specific loading can provide more accurate skeletons for each destination page.

### 4. Reduce avoidable server waterfalls

Audit protected admin pages for avoidable sequential fetches.

Examples already identified:
- `app/admin/(protected)/crm/page.tsx` currently awaits multiple independent calls sequentially.
- Other pages should be reviewed to ensure independent data loads are parallelized where possible.

Design rule:
- Do not remove route-based server fetching.
- Do restructure independent fetches with parallel patterns where safe.
- Favor fast shell + skeleton first, then data resolution.

## Architecture Notes

### Current shell model
- `app/admin/(protected)/layout.tsx` renders the protected admin shell.
- `components/admin/admin-shell.tsx` provides the persistent admin frame.
- `components/admin/sidebar.tsx` renders the navigational menu.

### Intended post-change model
- The shell remains persistent during route changes.
- Sidebar active state can change optimistically before route commit.
- The content pane uses App Router loading boundaries to display immediate skeletons.
- The real route state remains the final source of truth.

## UX Flow

Example: user clicks `Services` while currently on `Dashboard`.

1. User clicks `/admin/services` in the sidebar.
2. Sidebar immediately highlights `Services` using optimistic state.
3. Route navigation starts.
4. Protected admin shell remains visible.
5. Content pane immediately shows loading skeleton UI.
6. Server page fetches destination data.
7. Loaded page replaces the skeleton.
8. Optimistic state reconciles with the final `pathname`.

## Edge Cases

### Rapid multiple clicks
- The latest click should win visually.
- Navigation remains interruptible.
- Active state should ultimately reconcile to the last committed route.

### Redirect or permission change
- If route access fails and the app redirects to `/admin/dashboard` or `/admin/login`, optimistic state must not remain stuck on the originally clicked item.
- The committed `pathname` must always correct the sidebar.

### Back/forward browser navigation
- Since browser history changes may not originate from a sidebar click, sidebar state must re-sync from `pathname`.

### Slow prefetch or cold navigation
- UX should still feel responsive even if prefetch was not ready.
- The user should see immediate active state change plus skeleton feedback.

### Layout-level auth latency
- The design keeps route protection intact.
- The implementation should avoid any unnecessary visual blanking of the shell while protected content changes.

## Affected Files

Primary expected touch points:
- `components/admin/sidebar.tsx`
- `app/admin/(protected)/loading.tsx`
- `app/admin/(protected)/layout.tsx`
- `app/admin/(protected)/dashboard/page.tsx`
- `app/admin/(protected)/crm/page.tsx`
- `app/admin/(protected)/discount-codes/page.tsx`
- selected admin route `loading.tsx` files

Potential secondary review targets:
- other protected admin page files with sequential data fetching
- shared admin skeleton components if needed for consistency

## Error Handling

- Do not rely on the optimistic state as permanent truth.
- Always reconcile to the actual route.
- Keep route-level error boundaries responsible for page errors.
- Avoid full-page blocking spinners that hide the admin shell.

## Testing and Verification

### Manual verification
1. Click `Dashboard -> Services -> Purchases` and confirm:
   - active sidebar item changes immediately
   - content pane shows skeleton immediately
   - page content swaps in when ready

2. Click multiple sidebar items quickly and confirm:
   - latest click wins
   - highlight never gets stuck on the wrong route

3. Simulate slow network/server response and confirm:
   - shell stays visible
   - content pane shows loading state rather than appearing frozen

4. Use browser back/forward and confirm:
   - sidebar active state always matches the visible route

5. Simulate expired auth or redirect and confirm:
   - sidebar state re-syncs to the actual destination route

### Code verification
- Confirm loading boundary placement is correct for the protected route branch.
- Confirm no new duplicated navigation state becomes a permanent source of truth.
- Confirm sequential server fetches are only changed where independent and safe.

## Implementation Order

Recommended implementation sequence:
1. Add optimistic active state to the admin sidebar.
2. Add shared protected-route loading boundary.
3. Add or refine route-specific loading skeletons for missing admin pages.
4. Audit and parallelize avoidable sequential server fetches.

This order delivers the main UX gain early while keeping risk controlled.

## Success Criteria

The work is successful when:
- Clicking a sidebar item immediately changes the active visual state.
- The content pane immediately transitions into a skeleton/loading state.
- Users no longer perceive the tab change as waiting for server response before switching.
- The admin shell remains stable and interactive during transitions.
- Final state always matches the real committed route.

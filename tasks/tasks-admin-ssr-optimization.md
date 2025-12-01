# Admin Dashboard SSR Optimization

Optimize admin dashboard pages by converting slow client-side data fetching to fast server-side rendering using React Server Components (RSC).

## Relevant Files

- `app/admin/dashboard/page.tsx` - Main dashboard, convert to SSR with stats pre-fetching
- `app/admin/services/page.tsx` - Services management, convert to hybrid SSR
- `app/admin/vouchers/page.tsx` - Vouchers management, convert to hybrid SSR
- `components/admin/dashboard-client.tsx` - New client component for dashboard interactivity
- `components/admin/services-client.tsx` - New client component for services CRUD
- `components/admin/vouchers-client.tsx` - New client component for vouchers actions
- `lib/actions/dashboard.ts` - New server action for dashboard stats
- `lib/supabase/server.ts` - Server-side Supabase client (existing)

### Notes

- Admin pages require authentication - use cookies-based auth check on server
- Keep all CRUD, search, filter logic in client components
- Server components only fetch initial data
- Use `bunx tsc --noEmit` to verify TypeScript compilation

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout: `git checkout -b feature/admin-ssr-optimization`

- [x] 1.0 Create Dashboard Stats Server Action
  - [x] 1.1 Create `lib/actions/dashboard.ts` with `getDashboardStats()` function
  - [x] 1.2 Implement parallel queries for services count, vouchers stats, orders total, reviews avg
  - [x] 1.3 Return pre-calculated stats object (totalRevenue, activeVouchers, etc.)

- [x] 2.0 Optimize Dashboard Page with SSR
  - [x] 2.1 Create `components/admin/dashboard-client.tsx` client component
  - [x] 2.2 Move all dashboard JSX and chart logic to client component
  - [x] 2.3 Define props interface for pre-fetched stats
  - [x] 2.4 Convert `app/admin/dashboard/page.tsx` to async Server Component
  - [x] 2.5 Fetch stats server-side using `getDashboardStats()`
  - [x] 2.6 Pass stats as props to `DashboardClient`

- [x] 3.0 Optimize Services Page with SSR
  - [x] 3.1 Create `components/admin/services-client.tsx` client component
  - [x] 3.2 Move search, filter, CRUD logic to client component
  - [x] 3.3 Accept `initialServices` prop
  - [x] 3.4 Convert `app/admin/services/page.tsx` to async Server Component
  - [x] 3.5 Fetch services server-side, pass to client

- [x] 4.0 Optimize Vouchers Page with SSR
  - [x] 4.1 Create `components/admin/vouchers-client.tsx` client component
  - [x] 4.2 Move search, filter, action dialogs to client component
  - [x] 4.3 Accept `initialVouchers` prop
  - [x] 4.4 Convert `app/admin/vouchers/page.tsx` to async Server Component
  - [x] 4.5 Fetch vouchers server-side, pass to client

- [x] 5.0 Testing and Validation
  - [x] 5.1 Run `bunx tsc --noEmit` to verify TypeScript
  - [ ] 5.2 Test dashboard - stats should load instantly
  - [ ] 5.3 Test services - list should load instantly, CRUD still works
  - [ ] 5.4 Test vouchers - list should load instantly, actions still work
  - [ ] 5.5 Verify auth redirect still works for unauthenticated users

- [ ] 6.0 Commit and Merge
  - [ ] 6.1 Stage all changes
  - [ ] 6.2 Commit: `perf: implement SSR for admin dashboard pages`
  - [ ] 6.3 Push and merge to master

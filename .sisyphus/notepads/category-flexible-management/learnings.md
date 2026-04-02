
- 2026-03-25: Current Supabase migrations in this repo use `public.*` identifiers, `DROP POLICY IF EXISTS`, and split RLS into `select/insert/update/delete` policies guarded by `public.is_admin()`.
- 2026-03-25: `components/admin/services-client.tsx`, `app/page.tsx`, and `context/StoreContext.tsx` still read the legacy enum category directly, so Task 1 needs additive schema compatibility instead of nullability or runtime contract changes.
- 2026-03-25: A unique lowercase `slug` plus explicit `is_active` and `services.category_id` indexes matches the repo’s current migration style without expanding into Task 2/3 runtime refactors.
- 2026-03-25: Follow-up verification found the repo baseline guarantees UUID generation via `uuid-ossp`, so additive migrations here should use `uuid_generate_v4()` unless they explicitly enable another UUID provider in-scope.
- 2026-03-25: Task 2 keeps the frontend code paths compiling by using a resolved category object contract plus a transition code map, so later adapters can switch from enum codes to relational category objects without touching payment/order/admin types.
- 2026-03-26: The last compile blocker was an optimistic admin `Service` literal missing `category_id`; adding `category_id: null` was sufficient once `lib/database.types.ts` returned to a schema-faithful row export.
- 2026-03-26: In this repo, the safest relational rollout is to widen service action read results with `category_relation:service_categories!services_category_id_fkey(*)` while leaving the legacy enum `category` field intact for existing adapters.
- 2026-03-26: Assignment-option category reads need their own active-only action because service detail/edit reads must still be able to surface inactive linked categories for existing records.
## 2026-03-26

- Runtime service adapters now prefer `category_relation` directly and fall back to a generic `Layanan` category object when the relation is missing.
- The legacy enum-code bridge was only needed in client/runtime adapters, so removing it from those paths kept `lib/constants.ts` simpler without affecting category management UX.
## 2026-03-26 F3 manual QA
- Targeted UI tests passed for `components/services-section.test.tsx` and `components/admin/services-client.test.tsx`, covering landing badge rendering, admin embedded category CRUD UI, inactive-category edit preservation, and service payload mapping.
- Server action tests passed for `lib/actions/__tests__/services.test.ts` and `lib/actions/__tests__/service-categories.test.ts`, including joined relational reads, delete protection for referenced categories, and category assignment save-path behavior.
- LSP diagnostics reported zero issues on `app/page.tsx`, `components/services-section.tsx`, `app/admin/(protected)/services/page.tsx`, `components/admin/services-client.tsx`, and `components/admin/services-client.test.tsx`.
- Live route probing confirmed `/` returns HTTP 200 and `/admin/services` redirects to `/admin/login` without an authenticated browser session.

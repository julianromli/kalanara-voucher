# Flexible Service Categories for Landing + Admin

## TL;DR
> **Summary**: Add a database-driven category system for spa services, show category badges on landing-page service cards, and embed category management into the existing admin services area without introducing a new admin route.
> **Deliverables**:
> - Supabase migration for `service_categories` and `services.category_id`
> - Updated service reads/writes using resolved category data
> - Landing-page service cards showing category badges beside duration
> - Admin services UI with dynamic category filter/select plus embedded category CRUD
> - Vitest coverage for migration-sensitive service/category behavior
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3/4 → 5/6 → F1-F4

## Context
### Original Request
- Fungsikan dan integrasikan `category` service di list service di main page.
- Badge category saat ini tidak muncul di landing page, padahal muncul di admin dashboard.
- Badge category harus muncul di card service landing page di pojok kiri atas, sejajar dengan `duration`.
- Admin harus bisa customize list category dan menambah custom category.
- Category harus fleksibel, tidak hardcoded/statis, dan terintegrasi dengan database Supabase.

### Interview Summary
- Category management tetap berada di area admin `/admin/services`, bukan halaman admin baru.
- Category yang sudah dipakai service boleh di-rename dan dinonaktifkan.
- Category yang masih direferensikan service tidak boleh dihapus permanen.
- Verification strategy memakai **tests-after** di atas baseline repo saat ini: Vitest + `bunx tsc --noEmit` + `bun run lint`.
- Default applied: `slug` category dibuat dari `name` yang sudah di-trim, lowercase, hyphenated, unik case-insensitive, dan **tidak berubah saat rename** kecuali dibuat ulang manual lewat migrasi/ops terkontrol.

### Metis Review (gaps addressed)
- Gunakan migrasi aditif: tambah `service_categories` dan `services.category_id`, backfill dulu, baru hapus jalur statis setelah semua read/write aman.
- Jangan perluas scope ke halaman admin category terpisah atau public category browsing/filtering.
- Kategori inactive harus hilang dari opsi assignment baru, tetapi tetap bisa dirender untuk service lama yang masih terhubung.
- Hapus hanya boleh untuk category yang tidak lagi direferensikan service mana pun.
- Semua runtime path landing/admin harus memakai source category ter-resolve dari DB, bukan enum/label map statis.

## Work Objectives
### Core Objective
Mengganti sistem category service dari hardcoded enum menjadi entitas database yang dikelola admin, lalu memakai data category yang sama untuk render badge di landing page dan admin services.

### Deliverables
- Migration SQL baru di `lib/supabase/migrations/` untuk membuat tabel category dan relasi service.
- Types database/frontend yang merepresentasikan service dengan category relational data.
- Server actions category + service query updates.
- Embedded category management UI pada `components/admin/services-client.tsx`.
- Badge category di `components/services-section.tsx` pada area kiri atas berjajar dengan durasi.
- Vitest coverage untuk lifecycle category dan rendering utama.

### Definition of Done (verifiable conditions with commands)
- `bunx vitest run lib/actions/__tests__/service-categories.test.ts lib/actions/__tests__/services.test.ts components/services-section.test.tsx components/admin/services-client.test.tsx`
- `bunx tsc --noEmit`
- `bun run lint`
- Landing-page service cards menampilkan badge category ter-resolve dari DB dan duration tanpa overlap pada layout desktop/mobile.
- Admin `/admin/services` menampilkan category list dinamis, bisa tambah custom category, rename category, deactivate category, dan menolak delete category yang masih dipakai service.
- Tidak ada lagi runtime dependency pada `ServiceCategory` enum statis untuk display/editing/filtering category service di landing/admin path.
- Jika repo masih memiliki lint error lama di luar scope perubahan ini, evidence harus menunjukkan bahwa pekerjaan category ini tidak menambah lint error baru pada file yang disentuh.

### Must Have
- `service_categories` sebagai source of truth category.
- `services.category_id` foreign key dengan `ON DELETE RESTRICT`.
- Backfill empat category lama (`MASSAGE`, `FACIAL`, `BODY_TREATMENT`, `PACKAGE`) ke tabel baru.
- Landing page dan admin memakai hasil join category yang sama.
- Category inactive tidak muncul di dropdown assignment baru, tetapi service existing tetap dapat menampilkan badge category-nya.
- Embedded category management reuse permission `AdminPermission.SERVICES_MANAGE`.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT membuat halaman admin baru untuk category management.
- Must NOT menambahkan public category filters/browsing pada landing page.
- Must NOT menghapus kolom/enum category lama sebelum semua read/write/test selesai pada jalur baru.
- Must NOT mempertahankan `CATEGORY_LABELS`, enum unions, atau select option hardcoded pada runtime landing/admin setelah migrasi selesai.
- Must NOT mengizinkan delete category yang masih direferensikan service aktif maupun nonaktif.
- Must NOT mengubah scope ke orders/vouchers/reviews selain dampak type/query yang benar-benar diperlukan oleh service relation.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after + Vitest (`vitest.config.ts`)
- QA policy: Every task has agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: schema foundation + shared type contracts + action tests
Wave 2: service/category data flow + admin embedded management
Wave 3: landing badge rendering + cleanup/removal of static category runtime usage

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2, 3, 4, 5, 6
- Task 2 blocks Tasks 3, 4, 5, 6
- Task 3 blocks Tasks 4, 5, 6
- Task 4 blocks Task 6
- Task 5 blocks Task 6
- Tasks 1-6 all block F1-F4

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → `unspecified-high`, `quick`
- Wave 2 → 2 tasks → `unspecified-high`, `visual-engineering`
- Wave 3 → 2 tasks → `visual-engineering`, `quick`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add Supabase category schema and transition-safe backfill

  **What to do**: Create a new migration in `lib/supabase/migrations/` that adds `service_categories` with columns `id uuid`, `slug text unique`, `name text`, `sort_order integer`, `is_active boolean`, `created_at`, `updated_at`; add `services.category_id uuid` referencing `service_categories(id)` with `ON DELETE RESTRICT`; seed/backfill the four existing static categories; update all existing `services` rows by mapping legacy enum values into new category records; add indexes for `service_categories.slug`, `service_categories.is_active`, and `services.category_id`; keep legacy `services.category` enum column in place for this migration wave; add/extend SQL for `updated_at` trigger and RLS so public can read active categories and admins can fully manage categories.
  **Must NOT do**: Must NOT drop `services.category`, must NOT drop enum `service_category`, must NOT create a separate admin-only schema, must NOT allow public writes to categories.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: schema/RLS/backfill work spans SQL design and migration safety.
  - Skills: [`supabase-postgres-best-practices`] — why needed: enforce FK/index/RLS/backfill safety.
  - Omitted: [`frontend-skill`] — why not needed: no UI work in this task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5, 6] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `lib/supabase/migrations/001_initial_schema.sql:14-62` — existing enum-based service schema and index conventions being transitioned.
  - Pattern: `lib/supabase/migrations/001_initial_schema.sql:217-246` — existing RLS pattern for public-read/admin-all service data.
  - Pattern: `lib/supabase/migrations/006_services_storage.sql:13-51` — migration style for drop/create policy updates.
  - API/Type: `lib/database.types.ts:12-64` — current service row/insert/update types that the migration will invalidate and later require update.
  - API/Type: `lib/database.types.ts:397-439` — current DB enum exports to deprecate from runtime usage later.
  - External: `https://supabase.com/docs/guides/database/postgres/row-level-security` — RLS policy conventions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] New migration file creates `service_categories` and `services.category_id` with `ON DELETE RESTRICT` and required indexes.
  - [ ] Migration seeds `MASSAGE`, `FACIAL`, `BODY_TREATMENT`, and `PACKAGE` into `service_categories` with stable slugs and deterministic sort order.
  - [ ] Migration backfills every existing `services` row so `category_id` is non-null after backfill step.
  - [ ] Migration adds public read/admin-all policies for categories matching existing service access intent.
  - [ ] Legacy `services.category` remains present after this task for transition safety.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Migration file statically proves additive relational category rollout
    Tool: Bash
    Steps: Run `bunx tsc --noEmit` after updating generated/manual DB types and inspect migration filename exists under `lib/supabase/migrations/`
    Expected: Typecheck passes for migration-related type updates and repository contains exactly one new migration implementing category table + FK rollout
    Evidence: .sisyphus/evidence/task-1-category-schema.txt

  Scenario: Delete policy protects referenced categories by design
    Tool: Read
    Steps: Read the new migration and confirm `services.category_id` foreign key uses `ON DELETE RESTRICT` and no SQL path softens it to cascade/nullify
    Expected: FK definition explicitly restricts delete for referenced categories
    Evidence: .sisyphus/evidence/task-1-category-schema-error.txt
  ```

  **Commit**: YES | Message: `feat(services): add supabase-backed service categories` | Files: [`lib/supabase/migrations/*category*.sql`, `lib/database.types.ts`]

- [x] 2. Update database and frontend type contracts for relational categories

  **What to do**: Replace runtime dependence on static `ServiceCategory` enum with relational category types. Update `lib/database.types.ts` to include the new `service_categories` table, `services.category_id`, and relationship metadata. Update `lib/types.ts` so frontend `Service` no longer requires `ServiceCategory` enum; instead define a concrete category object shape for display, e.g. `{ id, slug, name, isActive }`, and make frontend `Service.category` use that object. Keep payment/order enums intact. Remove only the service-category enum/runtime path from frontend types while avoiding unrelated enum churn.
  **Must NOT do**: Must NOT remove payment/admin enums, must NOT leave `Service.category` as a bare string in frontend types, must NOT invent nullable category shape for steady-state runtime.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: bounded type-contract update once schema decision is fixed.
  - Skills: [] — why needed: repository already provides local type patterns.
  - Omitted: [`supabase-postgres-best-practices`] — why not needed: schema decisions are handled in Task 1.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [3, 4, 5, 6] | Blocked By: [1]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `lib/types.ts:13-18` — current static `ServiceCategory` enum to remove from service runtime.
  - Pattern: `lib/types.ts:72-83` — current frontend `Service` contract that must become relational.
  - Pattern: `lib/database.types.ts:12-64` — current `services` table type that must gain `category_id` and relationship metadata.
  - Pattern: `lib/database.types.ts:442-454` — existing joined type conventions for related entities.
  - Pattern: `app/page.tsx:15-24` — frontend adapter currently casts DB category enum and must be supported by new types.
  - Pattern: `context/StoreContext.tsx:74-83` — second adapter that currently casts the static category enum.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `lib/database.types.ts` defines `service_categories` table types and `services` relationship metadata.
  - [ ] `lib/types.ts` no longer exports/uses static service category enum in the frontend `Service` runtime contract.
  - [ ] Frontend `Service.category` is a resolved object suitable for badge rendering and admin filtering.
  - [ ] No runtime file in landing/admin paths requires `dbService.category as ServiceCategory` after this task’s dependent follow-up tasks are completed.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Type contracts compile after relational category conversion
    Tool: Bash
    Steps: Run `bunx tsc --noEmit`
    Expected: TypeScript passes with updated DB and frontend category contracts
    Evidence: .sisyphus/evidence/task-2-category-types.txt

  Scenario: Static service category enum is no longer required in runtime contracts
    Tool: Grep
    Steps: Search for `ServiceCategory` under `app/`, `components/`, `context/`, and `lib/`
    Expected: Any remaining matches are limited to migration fallback or explicitly non-runtime legacy comments/tests; landing/admin runtime paths no longer depend on it
    Evidence: .sisyphus/evidence/task-2-category-types-error.txt
  ```

  **Commit**: NO | Message: `refactor(services): update relational category types` | Files: [`lib/database.types.ts`, `lib/types.ts`]

- [x] 3. Refactor service and category server actions around joined relational data

  **What to do**: Extend `lib/actions/services.ts` so service reads (`getServices`, `getAllServices`, `getServiceById`, `getActiveServicesForScalevSync` where relevant) select joined category data from Supabase instead of raw `services.category`. Add category actions in the same file or a dedicated `lib/actions/service-categories.ts` file for list/create/update/deactivate/delete operations, all guarded by `AdminPermission.SERVICES_MANAGE`. Revalidate the same surfaces impacted by landing/admin services after category writes. Implement delete logic that first checks for referencing services and returns a domain-safe failure. Implement create/update validation enforcing trimmed names, case-insensitive uniqueness, slug generation/stability, and inactive-category exclusion from new assignment lists.
  **Must NOT do**: Must NOT expose category write actions without admin permission, must NOT return inactive categories in assignment-option reads, must NOT silently delete referenced categories, must NOT leave landing reads dependent on static label maps.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: multiple server actions, permission enforcement, validation, and transition-safe query joins.
  - Skills: [] — why needed: repo patterns are sufficient.
  - Omitted: [`frontend-skill`] — why not needed: no visual work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4, 5, 6] | Blocked By: [1, 2]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `lib/actions/services.ts:13-183` — current service action file to extend/refactor.
  - Pattern: `lib/actions/__tests__/orders-public.test.ts:35-41` — explicit Supabase relationship select assertion pattern.
  - Pattern: `lib/actions/__tests__/admin-users.test.ts:27-63` — mocking/permission test style for admin server actions.
  - API/Type: `lib/auth/admin-rbac.ts:8-18` — reuse `AdminPermission.SERVICES_MANAGE`.
  - API/Type: `lib/auth/admin-rbac-server.ts:127-168` — permission guard and audit log patterns.
  - Pattern: `lib/actions/orders.ts:4` and `lib/actions/services.ts:10` — current revalidation pattern via `revalidateTag`.
  - Pattern: `app/page.tsx:38-45` — landing page consumes `getServices()`.
  - Pattern: `app/admin/(protected)/services/page.tsx:5-9` — admin page consumes `getAllServices()`.
  - External: `https://supabase.com/docs/guides/database/joins-and-nesting` — join selection conventions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Public/admin service reads return resolved relational category data used directly by adapters/UI.
  - [ ] Category CRUD/list actions exist behind `AdminPermission.SERVICES_MANAGE`.
  - [ ] Category create/update enforces trimmed non-empty names and case-insensitive uniqueness.
  - [ ] Category create generates a stable slug from the first saved name; rename updates `name` only and preserves `slug`.
  - [ ] Category delete fails with deterministic error when any service still references it.
  - [ ] Assignment-option reads return active categories only, while service detail/edit reads still resolve inactive linked categories.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Server action tests cover category lifecycle and joined reads
    Tool: Bash
    Steps: Run `bunx vitest run lib/actions/__tests__/service-categories.test.ts lib/actions/__tests__/services.test.ts`
    Expected: Tests pass for create/rename/deactivate/delete guardrails and joined service category reads
    Evidence: .sisyphus/evidence/task-3-service-actions.txt

  Scenario: Referenced category deletion is rejected deterministically
    Tool: Bash
    Steps: Run the targeted Vitest case asserting delete failure for a category with linked services
    Expected: Test passes and surfaces a stable domain error/message instead of deleting or nullifying references
    Evidence: .sisyphus/evidence/task-3-service-actions-error.txt
  ```

  **Commit**: YES | Message: `feat(services): resolve relational category data in actions` | Files: [`lib/actions/services.ts`, `lib/actions/service-categories.ts`, `lib/actions/__tests__/service-categories.test.ts`, `lib/actions/__tests__/services.test.ts`]

- [x] 4. Embed dynamic category management into admin services experience

  **What to do**: Refactor `components/admin/services-client.tsx` so it receives both services and categories (or loads category actions predictably through passed props/actions), removes local `ServiceCategory` union and `CATEGORY_LABELS`, and uses DB-driven category records for the service form select, category filter, and service card badge. Add an embedded category management section inside the existing `/admin/services` page (same route), implemented as a dedicated subpanel/section in the page layout — not a new route — that supports add custom category, rename category, deactivate/reactivate category, and delete unused category. Ensure editing a service already linked to an inactive category preserves the selected value and shows it clearly, but inactive categories do not appear in create/new assignment lists. Keep existing auth/toast patterns and optimistic interaction only where it remains safe.
  **Must NOT do**: Must NOT create `/admin/categories`, must NOT hardcode category options, must NOT allow selecting inactive categories for brand-new services, must NOT regress current service image management and search/filter UX.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: significant admin UI/state refactor with embedded management controls.
  - Skills: [`shadcn`] — why needed: existing select/dialog/button primitives are shadcn-based.
  - Omitted: [`frontend-skill`] — why not needed: this is dashboard CRUD, not marketing UI.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6] | Blocked By: [1, 2, 3]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `components/admin/services-client.tsx:56-80` — current hardcoded service category types/default form.
  - Pattern: `components/admin/services-client.tsx:103-183` — current service filter state and matching logic.
  - Pattern: `components/admin/services-client.tsx:530-550` — current hardcoded category filter select to replace.
  - Pattern: `components/admin/services-client.tsx:631-634` — existing admin category badge location used as visual reference.
  - Pattern: `components/admin/services-client.tsx:776-796` — current hardcoded service form category select to replace.
  - Pattern: `app/admin/(protected)/services/page.tsx:1-9` — page wrapper that must pass all required initial data to client component.
  - Pattern: `components/ui/select.tsx` via repo usage — dropdown primitive already in use.
  - Test: `components/__tests__/settings-client.test.tsx:1-18` and `components/__tests__/admin-users-client.test.tsx:1-18` — examples of current skipped client tests; this task should avoid repeating skip-only coverage.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Admin services page renders service cards with category badge text from relational category data.
  - [ ] Category filter and service form select are populated from live category records, not static maps.
  - [ ] Admin can add a custom category and immediately use it for a service without code changes.
  - [ ] Admin can rename and deactivate a category in the same `/admin/services` area.
  - [ ] Admin cannot delete a category while it is still linked to any service.
  - [ ] Editing an existing service linked to an inactive category preserves the current category selection while clearly preventing new inactive assignments.
  - [ ] Embedded category management UI is implemented as a dedicated section within the existing page body, above the services grid filters.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Admin client renders dynamic category options and supports custom category creation flow
    Tool: Bash
    Steps: Run `bunx vitest run components/admin/services-client.test.tsx`
    Expected: Tests pass for dynamic filter/select options, add-category flow, rename/deactivate flow, and delete rejection for referenced categories
    Evidence: .sisyphus/evidence/task-4-admin-category-ui.txt

  Scenario: Inactive linked categories remain editable-safe but not assignable to new services
    Tool: Bash
    Steps: Run the targeted Vitest case asserting edit-form preservation and create-form exclusion for inactive categories
    Expected: Existing linked inactive category appears only where needed; create/new assignment list omits it
    Evidence: .sisyphus/evidence/task-4-admin-category-ui-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): manage dynamic categories in services dashboard` | Files: [`components/admin/services-client.tsx`, `app/admin/(protected)/services/page.tsx`, `components/admin/services-client.test.tsx`]

- [x] 5. Render category badges on landing-page service cards using relational category data

  **What to do**: Update the landing-page data path so `app/page.tsx` adapts DB services into frontend services with resolved category objects, then update `components/services-section.tsx` to render the category badge in the image overlay area at top-left while keeping the existing duration pill at top-right. The category badge must use the resolved category name from DB, visually align with duration, and degrade safely if an unexpected null/legacy category slips through during transition. Preserve current card animation, image treatment, and typography.
  **Must NOT do**: Must NOT hardcode category labels in landing component, must NOT move duration out of the top overlay row, must NOT create a category filter/browse UI on the landing page.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: focused public UI refinement with data adapter adjustments.
  - Skills: [] — why needed: component is already custom and simple.
  - Omitted: [`shadcn`] — why not needed: landing card overlay does not use shadcn primitives.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [6] | Blocked By: [1, 2, 3]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `app/page.tsx:15-24` — current DB-to-frontend adapter that still casts enum category.
  - Pattern: `app/page.tsx:38-45` — landing page fetch chain for services.
  - Pattern: `components/services-section.tsx:42-67` — image card overlay where duration pill currently sits at top-right.
  - Pattern: `components/admin/services-client.tsx:631-634` — admin badge visual reference for service category display.
  - API/Type: `lib/types.ts:72-83` — frontend service shape consumed by `ServicesSection`.
  - Test: `app/checkout/success/page.test.tsx:28-147` — current component test style using Testing Library and text-level assertions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Landing-page service cards render a category badge at top-left and duration pill at top-right for every service with resolved category data.
  - [ ] Badge text uses the DB-resolved category name, not a static label map.
  - [ ] Existing service cards keep current image, hover, and animation behavior.
  - [ ] Transition fallback prevents runtime crashes if category relation is temporarily missing during rollout.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Landing page service cards show category badges from resolved relational data
    Tool: Bash
    Steps: Run `bunx vitest run components/services-section.test.tsx`
    Expected: Tests pass asserting category badge text renders in each card alongside duration metadata
    Evidence: .sisyphus/evidence/task-5-landing-badges.txt

  Scenario: Missing transitional category data does not crash landing rendering
    Tool: Bash
    Steps: Run the targeted Vitest case with a service missing its resolved category object or fallback label path
    Expected: Component renders safely with deterministic fallback behavior instead of throwing
    Evidence: .sisyphus/evidence/task-5-landing-badges-error.txt
  ```

  **Commit**: YES | Message: `feat(landing): show service category badges` | Files: [`app/page.tsx`, `components/services-section.tsx`, `components/services-section.test.tsx`]

- [x] 6. Remove static category runtime usage and align secondary service adapters

  **What to do**: Remove remaining runtime dependencies on static service category constructs across the repo sections touched by this feature. Specifically update `context/StoreContext.tsx` to use relational category adapters instead of enum casts; remove or retire category-specific runtime exports from `lib/constants.ts` that were only supporting static category display/config; ensure any remaining service list/filter logic in landing/admin paths reads relational category fields (`id`, `slug`, `name`, `isActive`) instead of static values. Keep any legacy SQL enum only as a transition artifact until a later cleanup migration, but make sure no runtime code depends on it.
  **Must NOT do**: Must NOT delete unrelated demo data/constants used elsewhere unless they directly block typecheck/runtime, must NOT change payment/category-unrelated constants, must NOT leave split sources of truth for category labels.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: cleanup/alignment pass across a small number of known files.
  - Skills: [] — why needed: plain repository cleanup.
  - Omitted: [`frontend-skill`] — why not needed: not design-heavy.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked By: [3, 4, 5]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `context/StoreContext.tsx:17` — lingering import of `ServiceCategory` in runtime path.
  - Pattern: `context/StoreContext.tsx:74-83` — adapter still casting DB category enum.
  - Pattern: `lib/constants.ts:206-234` — static `SERVICE_CATEGORIES` config to retire from runtime source-of-truth usage.
  - Pattern: `lib/constants.ts:319-325` — category-based demo helpers tied to static enum.
  - Pattern: `app/page.tsx:11-24` — landing adapter currently tied to static enum.
  - Pattern: `components/admin/services-client.tsx:56-80` — hardcoded category structures that must be fully removed by dependent completion.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `context/StoreContext.tsx` no longer imports or casts `ServiceCategory` for runtime service adaptation.
  - [ ] No landing/admin runtime path depends on `SERVICE_CATEGORIES`, `CATEGORY_LABELS`, or static service-category unions.
  - [ ] Typecheck and lint pass without category-related runtime drift.
  - [ ] Static category code that remains is limited to migration legacy support or clearly non-runtime/demo-only references.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Repository-wide runtime cleanup removes static category usage from landing/admin flows
    Tool: Grep
    Steps: Search for `ServiceCategory`, `SERVICE_CATEGORIES`, and `CATEGORY_LABELS` across `app/`, `components/`, `context/`, and `lib/`
    Expected: No runtime landing/admin matches remain except intentional legacy migration comments/tests outside active codepaths
    Evidence: .sisyphus/evidence/task-6-category-cleanup.txt

  Scenario: Cleanup does not break compile/lint baseline
    Tool: Bash
    Steps: Run `bunx tsc --noEmit && bun run lint`
    Expected: TypeScript passes; if repo-wide lint still reports known unrelated failures, category-touched files do not introduce new lint errors and evidence captures that distinction explicitly
    Evidence: .sisyphus/evidence/task-6-category-cleanup-error.txt
  ```

  **Commit**: YES | Message: `refactor(services): remove static category runtime usage` | Files: [`context/StoreContext.tsx`, `lib/constants.ts`, any remaining service-category runtime files`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: `test(services): add coverage for dynamic categories`
- Commit 2: `feat(services): add supabase-backed service categories`
- Commit 3: `feat(admin): manage dynamic categories in services dashboard`
- Commit 4: `feat(landing): show service category badges`
- Commit 5: `refactor(services): remove static category runtime usage`

## Success Criteria
- Category display source is unified across landing and admin.
- Admin can add custom category without code changes.
- Category rename/deactivate/delete behavior matches agreed lifecycle rules.
- Existing services remain valid through migration and inactive category cases.
- No unresolved judgment calls remain for the executor.

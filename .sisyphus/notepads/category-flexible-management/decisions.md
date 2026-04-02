
- 2026-03-25: Kept `services.category` and the legacy enum untouched as the compatibility write path for Task 1, while adding `services.category_id` as the new relational column.
- 2026-03-25: Added a DB trigger that syncs legacy enum writes into `category_id` so current admin create/update flows do not leave the new FK null before later action-layer refactors land.
- 2026-03-25: Left `services.category_id` nullable in this wave because current runtime writes do not send it yet; existing rows are backfilled, but new enforcement belongs to the later joined-action rollout.
- 2026-03-25: Exported `Database["public"]["Tables"]["services"]["Row"]` directly as the service row type so `category_id` stays schema-mirroring instead of being re-made optional by a helper shim.
- 2026-03-25: Replaced the frontend service category enum contract with a resolved category object shape and a transition code map, preserving compile compatibility until the landing/admin adapters are updated.
- 2026-03-26: Kept the adapter bridge local to `app/page.tsx`, `context/StoreContext.tsx`, `app/voucher/[id]/page.tsx`, `lib/constants.ts`, and one optimistic admin literal so Task 2 stayed type-safe without drifting into join/action work.
- 2026-03-26: Refactored `lib/actions/services.ts` to return a joined `category_relation` alongside the legacy `services.category` code so Task 3 can unlock relational category reads without forcing Task 4/5 UI rewrites.
- 2026-03-26: Added dedicated `lib/actions/service-categories.ts` server actions behind `AdminPermission.SERVICES_MANAGE`, keeping category CRUD/list rules separate from service writes and preserving stable slugs by only updating `name` on rename.
- Fixed pre-existing TS error in app/admin/(protected)/services/page.tsx to pass bunx tsc --noEmit.
## 2026-03-26

- Kept category adaptation in runtime pages and store context relational-only, using a minimal fallback object instead of static service-category code maps.
## 2026-03-26 F3 verdict basis
- Used strongest evidence-based fallback for manual QA: executable tests + LSP diagnostics + live HTTP route probing.
- Treated `/admin/services` auth redirect and missing Chrome runtime as explicit environment blockers rather than feature failures.

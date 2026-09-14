# React Improvement Execution Roadmap

Source audit: [AUDIT.md](./AUDIT.md) at commit `b94c4ae`.

Each linked file is a self-contained execution plan. Keep each change independently reviewable, preserve Indonesian user-facing copy, and do not combine payment correctness with cosmetic cleanup.

| Order | Plan | Scope / audit findings | Dependencies | Status |
|---:|---|---|---|:---:|
| 1 | [001 — Secure privileged server actions](./001-secure-privileged-server-actions.md) | Replace externally callable service-role helpers with authorized actions and server-only internals. Finding 1. | None | DONE |
| 2 | [002 — Upgrade the vulnerable Next.js runtime](./002-upgrade-vulnerable-next-runtime.md) | Patch the scanner-verified RSC denial-of-service vulnerability. Finding 7. | None | DONE |
| 3 | [003 — Protect the order capability token](./003-protect-order-capability-token.md) | Remove the durable capability from URLs/browser data and keep third-party scripts off sensitive routes. Finding 6. | 001 | DONE |
| 4 | [004 — Enforce an atomic payment state machine](./004-enforce-payment-state-machine.md) | Make provider transitions monotonic and stop downstream work after rejected writes. Findings 2 and 4. | 001 | OPEN |
| 5 | [005 — Make voucher delivery idempotent](./005-make-voucher-delivery-idempotent.md) | Add durable per-item/per-channel claims and retry state. Finding 3. | 004 | OPEN |
| 6 | [006 — Remove the unused global store](./006-remove-unused-global-store.md) | Remove global client fetch, storage, and provider work with no production consumer. Finding 13. | 001 | OPEN |
| 7 | [007 — Scope navbar data work](./007-scope-navbar-data-work.md) | Route-scope the public shell and replace three reads with one narrow cached query. Finding 11. | 006 | OPEN |
| 8 | [008 — Scope and stabilize admin authentication](./008-scope-and-stabilize-auth.md) | Mount one admin-owned provider and reject stale async auth completions. Finding 12. | 006 | OPEN |
| 9 | [009 — Preload checkout payment options](./009-preload-checkout-payment-options.md) | Remove the post-hydration provider-request waterfall while retaining submit-time validation. Finding 10. | 004 | OPEN |
| 10 | [010 — Paginate admin data](./010-paginate-admin-data.md) | Bound list payloads and move filtering, counts, and dashboard aggregation to the database. Findings 14 and 15. | 001 | OPEN |
| 11 | [011 — Associate checkout controls](./011-associate-checkout-controls.md) | Connect labels, errors, and help text; make custom radio focus visible. Findings 17 and 18. | 009 | OPEN |
| 12 | [012 — Cancel stale voucher lookups](./012-cancel-stale-voucher-lookups.md) | Ensure only the newest manual, initial, or QR verification request can commit state. Finding 16. | None | OPEN |

## Execution checks

For every plan:

1. Add focused regression tests before changing payment, authorization, or fulfillment behavior.
2. Run `bunx tsc --noEmit`, `bun run lint`, relevant Vitest suites, and React Doctor on changed scope.
3. Manually test affected keyboard, checkout, admin, and failure paths with no console errors.
4. For performance work, record network, bundle, query, or Profiler evidence; do not declare success from memoization alone.
5. Re-run the full scanner after all plans and compare de-duplicated production-code diagnostics, not `docs/**` reference noise.

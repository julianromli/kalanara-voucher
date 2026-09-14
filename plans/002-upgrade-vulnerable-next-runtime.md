# 002 — Upgrade the vulnerable Next.js runtime

- **Status**: OPEN
- **Commit**: b94c4ae
- **Title**: Upgrade the vulnerable Next.js runtime
- **Severity**: HIGH
- **Category**: Security
- **Rule**: react-doctor/no-vulnerable-react-server-components
- **Estimated scope**: 2 files (`package.json`, `bun.lock`) plus regression verification

## Problem

The application pins a Next.js release whose bundled React Server Components runtime has a known high-severity denial-of-service vulnerability. Updating `react` alone cannot replace the runtime bundled by Next.js.

`package.json:36-43` currently contains:

```json
"jspdf": "^3.0.4",
"jsqr": "^1.4.0",
"lucide-react": "^0.555.0",
"next": "16.0.10",
"next-themes": "^0.4.6",
"qrcode": "^1.5.4",
"radix-ui": "^1.4.3",
"react": "19.2.0",
```

The framework ESLint package is also on an older 16.0 patch at `package.json:66-69`:

```json
"baseline-browser-mapping": "^2.8.32",
"eslint": "^9",
"eslint-config-next": "16.0.7",
"fast-check": "^4.4.0",
```

React Doctor reports at `react-doctor-report.json:7210-7219`:

> next@16.0.10 bundles a React Server Components runtime affected by a high-severity denial-of-service vulnerability (CVE-2026-23870) patched in Next.js 16.2.6

The scanner’s exact guidance—not an approximation—is:

> Upgrade Next.js to 16.2.6 (or newer). Next.js bundles its own React Server Components runtime, so bumping Next.js ships the fix. Run `npm install next@16.2.6`. See https://vercel.com/changelog/next-js-may-2026-security-release

The canonical prompt URL `https://www.react.doctor/prompts/rules/react-doctor/no-vulnerable-react-server-components.md` was unavailable (HTTP 404), and the rule explanation CLI was unavailable for this rule (unknown rule). Therefore the executor must follow the scanner’s exact quoted guidance instead of inventing a canonical recipe.

## Target

Use Bun, because this repository commits `bun.lock`. Minimum exact target:

```json
{
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "eslint-config-next": "16.2.6"
  }
}
```

Generate the lockfile update:

```bash
bun add --exact next@16.2.6
bun add --dev --exact eslint-config-next@16.2.6
```

A newer patched compatible Next 16 release is acceptable if official release/security notes confirm the CVE fix and compatibility. Keep `next` and `eslint-config-next` at the same selected release. Keep React 19.2.0 unchanged unless that release declares an incompatible peer requirement; if so, stop and document the required compatibility change first.

`bun.lock` must resolve the selected patched version and must not retain `next@16.0.10` as the root app framework.

## Repo conventions to follow

- Use Bun and package-manager-generated lockfile changes; never hand-edit `bun.lock`.
- Preserve exact pins for `next` and `eslint-config-next`.
- Keep the update to Next 16 and preserve App Router/React 19 conventions.
- Reject unrelated dependency or lockfile churn.

## Steps

1. At commit `b94c4ae`, record `bun pm ls next react react-dom eslint-config-next` and inspect official compatibility/security notes for the selected patched Next 16 release.
2. Install exact Next 16.2.6 and matching `eslint-config-next` with the Bun commands above, or use the same newer documented patched compatible release for both.
3. Review `package.json` and `bun.lock`; retain only intended framework/config and transitive changes.
4. Run focused route/component tests covering Server Components, API handlers, navigation, `next/font`, `next/script`, and protected layouts.
5. Run typecheck, lint, full tests, and a production build. The dependency upgrade warrants `bun run build` in addition to the repository’s standard typecheck.
6. Start the built app and smoke-test public, checkout, status, admin login, and protected admin routes for hydration/routing/middleware regressions.
7. Re-run React Doctor and confirm the CVE diagnostic is absent.

## Boundaries

- Do NOT treat a React-only upgrade as remediation.
- Do NOT remain below Next.js 16.2.6 or jump to a new Next major.
- Do NOT run broad `bun update`, hand-edit the lockfile, or accept unrelated churn.
- Do NOT preemptively edit application code. Split required compatibility fixes into separate reviewable work.
- STOP on drift from commit `b94c4ae`; re-scan and report it.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` clears `react-doctor/no-vulnerable-react-server-components` and does not lower the score.
  - `bunx tsc --noEmit`
  - `bun run lint`
  - Focused tests: `bun run test:run -- app/checkout/success/page.test.tsx app/checkout/[id]/checkout-page-client.test.tsx app/checkout/cart/cart-checkout-client.test.tsx app/api/scalev/create-payment/route.test.ts app/api/scalev/webhook/route.test.ts`
  - Full tests: `bun run test:run`
  - Framework regression: `bun run build`
  - Resolution proof: `bun pm ls next eslint-config-next react react-dom`
- **Behavior check**: Load `/`, a valid `/checkout/<id>`, `/checkout/cart`, `/checkout/success`, `/admin/login`, and an authenticated protected admin page. Confirm navigation, RSC rendering, route handlers, fonts/scripts, hydration, and auth redirects match the baseline.
- **Security check**: Confirm React Doctor no longer reports CVE-2026-23870 and the lockfile no longer resolves root `next@16.0.10`. Send a malformed/oversized request to a representative server endpoint in a non-production environment and confirm a controlled response without runtime loss of availability.
- **Done when**: patched compatible Next and matching ESLint config are locked with no unrelated churn, the CVE diagnostic is clear, and focused/full/type/lint/build/behavior/security checks pass.

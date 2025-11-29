# Semantic Color Token Migration

## Relevant Files

- `app/globals.css` - Design system tokens and CSS custom properties
- `app/page.tsx` - Landing page with hero, services, testimonials
- `app/verify/page.tsx` - Voucher verification page
- `app/voucher/[id]/page.tsx` - Voucher detail page
- `app/checkout/[id]/page.tsx` - Checkout flow page
- `app/review/[id]/page.tsx` - Review submission page
- `app/error.tsx` - Public error boundary
- `app/loading.tsx` - Public loading state
- `app/admin/dashboard/page.tsx` - Admin dashboard with stats and charts
- `app/admin/services/page.tsx` - Admin services management
- `app/admin/vouchers/page.tsx` - Admin vouchers management
- `app/admin/login/page.tsx` - Admin login page
- `app/admin/error.tsx` - Admin error boundary
- `app/admin/loading.tsx` - Admin loading state
- `app/admin/layout.tsx` - Admin layout wrapper
- `components/navbar.tsx` - Navigation component
- `components/qr-scanner.tsx` - QR code scanner component
- `context/ToastContext.tsx` - Toast notification context

### Notes

- This migration replaces hardcoded Tailwind colors (sage-*, sand-*, red-*, green-*, blue-*, amber-*) with semantic tokens
- Semantic tokens enable proper theming, dark mode support, and design consistency
- No unit tests required - this is a styling refactor with no logic changes
- Use `bunx tsc --noEmit` to verify TypeScript after changes
- Manual visual verification required after migration

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Color Mapping Reference

| Hardcoded | Semantic Token | Usage |
|-----------|----------------|-------|
| `bg-sand-50`, `bg-sand-100` | `bg-background` | Page backgrounds |
| `bg-white` | `bg-card` | Card surfaces |
| `bg-sage-50`, `bg-sage-100` | `bg-muted` or `bg-accent` | Subtle backgrounds |
| `bg-sage-700`, `bg-sage-800`, `bg-sage-900` | `bg-primary` | Hero sections, buttons |
| `text-sage-900` | `text-foreground` | Primary text |
| `text-sage-600`, `text-sage-700` | `text-muted-foreground` | Secondary text |
| `text-sage-400`, `text-sage-500` | `text-muted-foreground` | Tertiary text |
| `text-sand-50`, `text-sand-100` | `text-primary-foreground` | Text on dark bg |
| `text-sand-300`, `text-sand-400` | `text-muted-foreground` | Subtle light text |
| `border-sage-100`, `border-sage-200` | `border-border` | Borders |
| `ring-sage-500` | `ring-ring` | Focus rings |
| `bg-red-*`, `text-red-*` | `bg-destructive`, `text-destructive` | Errors |
| `bg-emerald-*`, `text-emerald-*` | `bg-success`, `text-success` | Success |
| `bg-blue-*`, `text-blue-*` | `bg-info`, `text-info` | Info states |
| `bg-amber-*`, `text-amber-*` | `bg-warning`, `text-warning` | Warnings |
| `text-gray-300` | `text-muted-foreground` | Disabled states |

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch `git checkout -b refactor/semantic-token-migration`

- [x] 1.0 Extend design system with status color tokens
  - [x] 1.1 Open `app/globals.css` and locate the `:root` section
  - [x] 1.2 Add `--success` and `--success-foreground` CSS variables for light mode (emerald-based)
  - [x] 1.3 Add `--info` and `--info-foreground` CSS variables for light mode (blue-based)
  - [x] 1.4 Add `--warning` and `--warning-foreground` CSS variables for light mode (amber-based)
  - [x] 1.5 Add corresponding dark mode values in `.dark` section
  - [x] 1.6 Register new tokens in `@theme inline` block (`--color-success`, `--color-info`, `--color-warning` and their foreground variants)
  - [x] 1.7 Run `bunx tsc --noEmit` to verify no TypeScript errors

- [x] 2.0 Migrate public pages to semantic tokens
  - [x] 2.1 Migrate `app/page.tsx` - Replace sage/sand colors with semantic tokens (hero, services, testimonials, footer sections)
  - [x] 2.2 Migrate `app/verify/page.tsx` - Replace status colors (valid/invalid/redeemed states) and form styling
  - [x] 2.3 Migrate `app/voucher/[id]/page.tsx` - Replace detail card colors and CTA button styling
  - [x] 2.4 Migrate `app/checkout/[id]/page.tsx` - Replace form sections, delivery options, payment methods, success state
  - [x] 2.5 Migrate `app/review/[id]/page.tsx` - Replace rating stars, form inputs, success state
  - [x] 2.6 Migrate `app/error.tsx` - Replace error icon and message styling with destructive tokens
  - [x] 2.7 Migrate `app/loading.tsx` - Replace skeleton and background colors
  - [x] 2.8 Run `bunx tsc --noEmit` to verify no TypeScript errors

- [x] 3.0 Migrate admin pages to semantic tokens
  - [x] 3.1 Migrate `app/admin/dashboard/page.tsx` - Replace stats cards, charts legend, recent orders table, quick links
  - [x] 3.2 Migrate `app/admin/services/page.tsx` - Replace service cards, form dialog, search input, status badges
  - [x] 3.3 Migrate `app/admin/vouchers/page.tsx` - Replace voucher table, status badges (active/redeemed/expired), action buttons, dialog
  - [x] 3.4 Migrate `app/admin/login/page.tsx` - Replace form inputs, button, error states
  - [x] 3.5 Migrate `app/admin/error.tsx` - Replace error styling with destructive/warning tokens
  - [x] 3.6 Migrate `app/admin/loading.tsx` - Replace skeleton colors
  - [x] 3.7 Migrate `app/admin/layout.tsx` - Replace background color
  - [x] 3.8 Run `bunx tsc --noEmit` to verify no TypeScript errors

- [x] 4.0 Migrate shared components to semantic tokens
  - [x] 4.1 Migrate `components/navbar.tsx` - Replace nav background, text colors, hover states, mobile menu
  - [x] 4.2 Migrate `components/qr-scanner.tsx` - Replace scanner overlay, corner borders, error/idle states
  - [x] 4.3 Run `bunx tsc --noEmit` to verify no TypeScript errors

- [x] 5.0 Migrate context providers to semantic tokens
  - [x] 5.1 Migrate `context/ToastContext.tsx` - Replace toast variant colors (success, error, info) with semantic tokens
  - [x] 5.2 Run `bunx tsc --noEmit` to verify no TypeScript errors

- [x] 6.0 Verify and commit changes
  - [x] 6.1 Run `bunx tsc --noEmit` for final TypeScript verification
  - [x] 6.2 Run `bun run lint` to check for linting errors (warnings only, no new errors)
  - [ ] 6.3 Start dev server and visually verify all pages render correctly
  - [ ] 6.4 Test dark mode toggle (if implemented) to verify theme switching works
  - [x] 6.5 Commit changes with message `refactor: migrate to semantic color tokens for theming support`
  - [ ] 6.6 Push branch and create PR (optional)

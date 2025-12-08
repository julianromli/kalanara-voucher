## Relevant Files

- `app/voucher/[id]/loading.tsx` - Skeleton loader for voucher detail page (NEW)
- `app/checkout/[id]/loading.tsx` - Skeleton loader for checkout page (NEW)
- `app/verify/loading.tsx` - Skeleton loader for voucher verification page (NEW)
- `app/review/[id]/loading.tsx` - Skeleton loader for review page (NEW)
- `app/admin/vouchers/loading.tsx` - Skeleton loader for admin vouchers list (NEW)
- `app/admin/services/loading.tsx` - Skeleton loader for admin services list (NEW)
- `components/admin/services-client.tsx` - Add optimistic updates for CRUD operations
- `components/admin/vouchers-client.tsx` - Add optimistic updates for status changes
- `app/checkout/[id]/page.tsx` - Enhanced phone validation with flexible format
- `components/ui/skeleton.tsx` - Existing skeleton component (reference only)

### Notes

- This feature focuses on UX improvements: skeleton loaders, optimistic updates, and form validation
- No unit tests required for loading.tsx files (they are purely presentational)
- Phone validation accepts both formats: `08989004363` and `+628989004363`
- Optimistic updates should revert on error and show toast notification
- Use existing `<Skeleton>` component from `components/ui/skeleton.tsx`

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch: `git checkout -b feature/ux-polish`

- [x] 1.0 Add skeleton loaders for public pages
  - [x] 1.1 Read `app/voucher/[id]/page.tsx` to understand the page structure
  - [x] 1.2 Create `app/voucher/[id]/loading.tsx` with skeleton matching: image, title, description, price card, CTA button
  - [x] 1.3 Read `app/checkout/[id]/page.tsx` to understand the form layout
  - [x] 1.4 Create `app/checkout/[id]/loading.tsx` with skeleton matching: form sections (customer, recipient, delivery, payment), order summary sidebar
  - [x] 1.5 Read `app/verify/page.tsx` to understand the verification UI
  - [x] 1.6 Create `app/verify/loading.tsx` with skeleton for QR scanner area and input field
  - [x] 1.7 Read `app/review/[id]/page.tsx` to understand the review form
  - [x] 1.8 Create `app/review/[id]/loading.tsx` with skeleton for rating stars and comment textarea

- [x] 2.0 Add skeleton loaders for admin pages
  - [x] 2.1 Read `app/admin/vouchers/page.tsx` and `components/admin/vouchers-client.tsx` to understand the vouchers list layout
  - [x] 2.2 Create `app/admin/vouchers/loading.tsx` with skeleton for: header, filters, data table with 5-6 rows
  - [x] 2.3 Read `app/admin/services/page.tsx` and `components/admin/services-client.tsx` to understand the services grid layout
  - [x] 2.4 Create `app/admin/services/loading.tsx` with skeleton for: header, filters, 6-card grid layout

- [x] 3.0 Implement optimistic updates for admin services
  - [x] 3.1 Read current `components/admin/services-client.tsx` implementation
  - [x] 3.2 Modify `handleSave` (create): Add service to list immediately with temp ID, replace with real data on success, remove on error
  - [x] 3.3 Modify `handleSave` (update): Update service in list immediately, revert to original on error
  - [x] 3.4 Modify `handleDelete`: Remove service from list immediately, restore on error
  - [x] 3.5 Add visual indicator for optimistic items (subtle opacity or loading state)

- [x] 4.0 Implement optimistic updates for admin vouchers
  - [x] 4.1 Read current `components/admin/vouchers-client.tsx` implementation
  - [x] 4.2 Identify status update actions (redeem, cancel, etc.)
  - [x] 4.3 Modify status update handlers: Update status immediately, revert on error
  - [x] 4.4 Add visual indicator for optimistic items

- [x] 5.0 Enhance checkout form validation
  - [x] 5.1 Read current form validation in `app/checkout/[id]/page.tsx`
  - [x] 5.2 Update phone validation pattern to accept both `08xxx` and `+62xxx` formats: `/^(\+62|62|0)[\d\s\-]{8,14}$/`
  - [x] 5.3 Add `onBlur` validation to show errors immediately after user leaves field
  - [x] 5.4 Add helper text under phone fields explaining accepted formats
  - [x] 5.5 Style invalid fields with red border and error message below

- [ ] 6.0 Test and verify all changes
  - [ ] 6.1 Run `bunx tsc --noEmit` to check for TypeScript errors
  - [ ] 6.2 Run `bun run lint` to check for linting issues
  - [ ] 6.3 Test skeleton loaders by adding artificial delay or slow network in browser DevTools
  - [ ] 6.4 Test optimistic updates: create/edit/delete services, verify instant UI feedback
  - [ ] 6.5 Test form validation: try both phone formats, verify error messages appear on blur
  - [ ] 6.6 Commit changes with message: `feat: add UX polish - skeletons, optimistic updates, validation`

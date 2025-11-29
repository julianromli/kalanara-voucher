# Tasks: Final Polish & Deployment

## Relevant Files

- `context/AuthContext.tsx` - Auth state management, fix sync issue
- `components/navbar.tsx` - Hide admin link from public users
- `app/voucher/[id]/page.tsx` - Add PDF generation
- `app/checkout/[id]/page.tsx` - Add loading states
- `app/page.tsx` - Add loading skeleton
- `app/admin/dashboard/page.tsx` - Add error boundary
- `app/error.tsx` - Global error boundary
- `app/loading.tsx` - Global loading state
- `components/ui/skeleton.tsx` - Skeleton component
- `lib/pdf.ts` - PDF generation utility

### Notes

- Current branch: `feature/supabase-integration`
- Environment variables already configured (skip Resend API key)
- Mobile testing will be done via Chrome DevTools

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`.

## Tasks

- [ ] 0.0 Git commit current changes
  - [ ] 0.1 Run `git status` to review all changes
  - [ ] 0.2 Stage all relevant files with `git add`
  - [ ] 0.3 Commit with descriptive message following conventional commits

- [ ] 1.0 Fix navbar admin link visibility
  - [ ] 1.1 Read current navbar.tsx implementation
  - [ ] 1.2 Update navbar to only show "Staff Login" for unauthenticated users
  - [ ] 1.3 Show "Dashboard" link only for authenticated admin users
  - [ ] 1.4 Remove "(SUPER_ADMIN)" text from public display

- [ ] 2.0 Fix auth state synchronization
  - [ ] 2.1 Read AuthContext.tsx to understand current state management
  - [ ] 2.2 Fix logout to properly clear auth state immediately
  - [ ] 2.3 Ensure login page doesn't show stale "Welcome, Staff" after logout
  - [ ] 2.4 Test auth flow (login → dashboard → logout → login page)

- [ ] 3.0 Add loading skeletons
  - [ ] 3.1 Install/verify shadcn skeleton component
  - [ ] 3.2 Create app/loading.tsx for global loading state
  - [ ] 3.3 Add skeleton to landing page services grid
  - [ ] 3.4 Add skeleton to admin dashboard stats

- [ ] 4.0 Add error boundaries
  - [ ] 4.1 Create app/error.tsx for global error handling
  - [ ] 4.2 Create app/admin/error.tsx for admin section errors
  - [ ] 4.3 Add user-friendly error messages with retry option

- [ ] 5.0 Implement PDF voucher generation
  - [ ] 5.1 Create lib/pdf.ts utility using jspdf
  - [ ] 5.2 Design voucher PDF layout (logo, service name, code, QR, expiry)
  - [ ] 5.3 Add "Download PDF" button to checkout success / voucher verification
  - [ ] 5.4 Test PDF generation with sample voucher

- [ ] 6.0 Mobile responsive testing & fixes
  - [ ] 6.1 Test landing page on mobile viewport (375px)
  - [ ] 6.2 Test checkout flow on mobile
  - [ ] 6.3 Test admin dashboard on tablet (768px)
  - [ ] 6.4 Fix any responsive issues found

- [ ] 7.0 Merge branch to master
  - [ ] 7.1 Commit any remaining changes
  - [ ] 7.2 Checkout master branch
  - [ ] 7.3 Merge feature/supabase-integration into master
  - [ ] 7.4 Push to remote

- [ ] 8.0 Deploy to Vercel
  - [ ] 8.1 Verify vercel.json or next.config.ts for deployment settings
  - [ ] 8.2 Document required environment variables for Vercel
  - [ ] 8.3 Provide deployment instructions to user

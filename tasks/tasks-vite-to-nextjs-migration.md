## Relevant Files

- `app/globals.css` - Tailwind CSS with custom sage/sand color palettes and font families
- `app/layout.tsx` - Root layout with Inter + Playfair Display fonts and context providers
- `lib/types.ts` - TypeScript interfaces and enums for vouchers, orders, etc.
- `lib/constants.ts` - Mock data and app constants
- `context/StoreContext.tsx` - State management with localStorage persistence
- `context/AuthContext.tsx` - Authentication state management
- `context/ToastContext.tsx` - Toast notification system
- `components/icons.tsx` - Re-exported lucide-react icons
- `components/navbar.tsx` - Navigation bar with Next.js Link/router
- `app/page.tsx` - Landing page (/)
- `app/voucher/[id]/page.tsx` - Voucher detail page (/voucher/:id)
- `app/checkout/[id]/page.tsx` - Checkout page (/checkout/:id)
- `app/verify/page.tsx` - Verify voucher page (/verify)
- `app/review/[id]/page.tsx` - Review page (/review/:id)
- `app/admin/login/page.tsx` - Admin login page (/admin/login)
- `app/admin/dashboard/page.tsx` - Admin dashboard page (/admin/dashboard)
- `.env.local` - Environment variables (GEMINI_API_KEY)

### Notes

- All page components will be Client Components (`'use client'`) since they use React hooks
- localStorage persistence maintained; Supabase integration planned for later
- Use `bunx tsc --noEmit` to type check after changes
- shadcn/ui components (Button, Input, Card, Dialog, Select) will be added as needed

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch (e.g., `git checkout -b feature/vite-to-nextjs-migration`)

- [x] 1.0 Install dependencies and configure environment
  - [x] 1.1 Install runtime dependencies: `bun add react-hook-form recharts react-qr-code jspdf jsqr qrcode @emailjs/browser`
  - [x] 1.2 Install dev dependencies: `bun add -D @types/qrcode`
  - [x] 1.3 Create `.env.local` file with `GEMINI_API_KEY=PLACEHOLDER_API_KEY`

- [x] 2.0 Update Tailwind and global styles
  - [x] 2.1 Add custom `sage` color palette to `globals.css` (sage-50 through sage-900)
  - [x] 2.2 Add custom `sand` color palette to `globals.css` (sand-50 through sand-900)
  - [x] 2.3 Add `font-sans` (Inter) and `font-serif` (Playfair Display) CSS variables
  - [x] 2.4 Copy any additional custom CSS utilities from the Vite project

- [x] 3.0 Create types and constants files
  - [x] 3.1 Create `lib/types.ts` with all TypeScript interfaces (Voucher, Order, Service, etc.)
  - [x] 3.2 Create `lib/constants.ts` with mock data and app constants (services, vouchers, etc.)

- [x] 4.0 Create context providers
  - [x] 4.1 Create `context/StoreContext.tsx` with state management and localStorage persistence
  - [x] 4.2 Create `context/AuthContext.tsx` with authentication state (admin login)
  - [x] 4.3 Create `context/ToastContext.tsx` with toast notification system

- [x] 5.0 Create shared components (icons, navbar)
  - [x] 5.1 Create `components/icons.tsx` with re-exported lucide-react icons
  - [x] 5.2 Create `components/navbar.tsx` converting react-router-dom Link to Next.js Link
  - [x] 5.3 Convert `useNavigate()` to `useRouter()` from `next/navigation` in navbar

- [x] 6.0 Update root layout with fonts and providers
  - [x] 6.1 Replace Geist fonts with Inter + Playfair Display using `next/font/google`
  - [x] 6.2 Update metadata (title, description) for Kalanara Spa
  - [x] 6.3 Wrap children with StoreProvider, AuthProvider, and ToastProvider
  - [x] 6.4 Add Navbar component to the layout

- [x] 7.0 Create page routes (7 pages)
  - [x] 7.1 Create `app/page.tsx` - Landing page with hero, services, vouchers sections
  - [x] 7.2 Create `app/voucher/[id]/page.tsx` - Voucher detail page with params prop
  - [x] 7.3 Create `app/checkout/[id]/page.tsx` - Checkout page with form and payment
  - [x] 7.4 Create `app/verify/page.tsx` - QR code scanner/verification page
  - [x] 7.5 Create `app/review/[id]/page.tsx` - Review submission page
  - [x] 7.6 Create `app/admin/login/page.tsx` - Admin login form
  - [x] 7.7 Create `app/admin/dashboard/page.tsx` - Protected admin dashboard with redirect logic

- [x] 8.0 Integrate shadcn/ui components
  - [x] 8.1 Add shadcn Button component for CTAs (if not already installed)
  - [x] 8.2 Add shadcn Input component for form inputs
  - [x] 8.3 Add shadcn Card component for service/voucher cards
  - [x] 8.4 Add shadcn Dialog component for admin modals
  - [x] 8.5 Add shadcn Select component for dropdowns
  - [x] 8.6 Replace custom components with shadcn equivalents while maintaining design

- [x] 9.0 Test and type check
  - [x] 9.1 Run `bunx tsc --noEmit` to check for TypeScript errors
  - [x] 9.2 Test all 7 routes manually in browser
  - [x] 9.3 Verify localStorage persistence works correctly
  - [x] 9.4 Test admin login/dashboard protected route redirect
  - [x] 9.5 Verify all navigation links work (including hash links like `/#services`)
  - [x] 9.6 Fix any remaining TypeScript or runtime errors

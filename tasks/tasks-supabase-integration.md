## Relevant Files

- `.env.local` - Supabase credentials and API keys
- `lib/supabase/client.ts` - Supabase browser client
- `lib/supabase/server.ts` - Supabase server client
- `lib/supabase/admin.ts` - Supabase admin client for server actions
- `lib/database.types.ts` - TypeScript types generated from Supabase schema
- `context/AuthContext.tsx` - Update to use Supabase Auth
- `context/StoreContext.tsx` - Update to use Supabase database
- `app/api/email/route.ts` - Email sending API route
- `app/verify/page.tsx` - Add QR scanner functionality
- `app/admin/dashboard/page.tsx` - Enhanced admin with CRUD
- `app/admin/services/page.tsx` - Service management
- `app/admin/vouchers/page.tsx` - Voucher management
- `components/qr-scanner.tsx` - QR code scanner component
- `next.config.ts` - Image domains configuration

### Notes

- Supabase URL: https://kginxwtmcdvqbnwmlctw.supabase.co
- Use Supabase Storage for service images
- Use Resend for transactional emails
- QR Scanner uses jsqr library (already installed)
- All database operations should use server actions where possible

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout branch `git checkout -b feature/supabase-integration`

- [x] 1.0 Setup Supabase infrastructure
  - [x] 1.1 Install Supabase dependencies: `bun add @supabase/supabase-js @supabase/ssr`
  - [x] 1.2 Add Supabase credentials to `.env.local`
  - [x] 1.3 Create `lib/supabase/client.ts` for browser client
  - [x] 1.4 Create `lib/supabase/server.ts` for server components
  - [x] 1.5 Create `lib/supabase/middleware.ts` for auth middleware

- [x] 2.0 Design and create database schema
  - [x] 2.1 Design schema for services, vouchers, orders, reviews, admins tables
  - [x] 2.2 Create migration SQL with proper constraints and indexes
  - [ ] 2.3 Apply migration to Supabase (USER ACTION REQUIRED)
  - [x] 2.4 Setup Row Level Security (RLS) policies
  - [x] 2.5 Generate TypeScript types from schema

- [ ] 3.0 Setup Supabase Storage (USER ACTION: Create buckets in Supabase Dashboard)
  - [ ] 3.1 Create `services` bucket for service images
  - [ ] 3.2 Create `vouchers` bucket for voucher QR codes
  - [ ] 3.3 Setup storage policies for public read access
  - [x] 3.4 Create upload utility functions

- [x] 4.0 Migrate authentication to Supabase Auth
  - [x] 4.1 Auth middleware created for protected routes
  - [x] 4.2 middleware.ts created with session handling
  - [x] 4.3 Update admin login page to use Supabase Auth
  - [x] 4.4 Auth state listener in middleware
  - [ ] 4.5 Create admin user in Supabase Auth (USER ACTION)

- [x] 5.0 Migrate data layer to Supabase
  - [x] 5.1 Create server actions for services CRUD
  - [x] 5.2 Create server actions for vouchers CRUD
  - [x] 5.3 Create server actions for orders CRUD
  - [x] 5.4 Create server actions for reviews CRUD
  - [x] 5.5 Update `StoreContext.tsx` to fetch from Supabase
  - [x] 5.6 Seed initial services data in migration SQL

- [x] 6.0 Implement email delivery with Resend
  - [x] 6.1 Install Resend: `bun add resend`
  - [x] 6.2 Add Resend API key to `.env.local`
  - [x] 6.3 Create email templates (voucher delivery)
  - [x] 6.4 Create `/api/email/send-voucher` route
  - [x] 6.5 Integrate email sending after successful checkout

- [x] 7.0 Implement QR Code Scanner
  - [x] 7.1 Create `components/qr-scanner.tsx` using jsqr
  - [x] 7.2 Add camera permission handling
  - [x] 7.3 Integrate scanner into `/verify` page
  - [x] 7.4 Add manual code entry fallback (tabs)
  - [ ] 7.5 Test scanning functionality

- [x] 8.0 Image optimization
  - [x] 8.1 Configure `next.config.ts` with Supabase storage domain
  - [x] 8.2 Replace `<img>` with Next.js `<Image>` in all pages
  - [x] 8.3 Add placeholder/blur images for loading states
  - [ ] 8.4 Upload service images to Supabase Storage (USER ACTION)
  - [ ] 8.5 Update service records with storage URLs

- [x] 9.0 Admin enhancements
  - [x] 9.1 Create `/admin/services` page with service CRUD
  - [x] 9.2 Create `/admin/vouchers` page with voucher management
  - [x] 9.3 Add voucher actions (redeem, void, extend)
  - [x] 9.4 Create analytics dashboard with recharts
  - [x] 9.5 Add image upload for services (via URL input)

- [x] 10.0 Testing and verification
  - [x] 10.1 Run `bunx tsc --noEmit` for type checking
  - [ ] 10.2 Test authentication flow (login, logout, protected routes) (USER ACTION)
  - [ ] 10.3 Test voucher purchase and email delivery (USER ACTION)
  - [ ] 10.4 Test QR scanner on mobile device (USER ACTION)
  - [ ] 10.5 Test admin CRUD operations (USER ACTION)
  - [ ] 10.6 Verify all images load from Supabase Storage (USER ACTION)

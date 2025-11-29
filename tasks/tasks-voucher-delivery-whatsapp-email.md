# Tasks: Voucher Delivery via WhatsApp & Email

## Relevant Files

- `app/checkout/[id]/page.tsx` - Main checkout page, add delivery options UI
- `app/api/whatsapp/send-voucher/route.ts` - NEW: WhatsApp send API endpoint
- `lib/types.ts` - Add DeliveryMethod and SendTo types
- `lib/utils/whatsapp.ts` - NEW: WhatsApp message formatting utility
- `lib/actions/vouchers.ts` - Update voucher creation to store delivery preferences
- `app/api/email/send-voucher/route.ts` - Existing email endpoint, may need updates

### Notes

- Phase 1 uses WhatsApp Web URL scheme (no API key needed)
- Phase 2 (future) can integrate WhatsApp Business API
- PRD Reference: Checkout Flow "Should Have" + Success Page "Must Have"
- Unit tests should be placed alongside the code files they are testing
- Use `bunx tsc --noEmit` for type checking

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch `feature/voucher-delivery-options`

- [x] 1.0 Update TypeScript types
  - [x] 1.1 Read `lib/types.ts` to understand current type definitions
  - [x] 1.2 Add `DeliveryMethod` enum/type: `'email' | 'whatsapp' | 'both'`
  - [x] 1.3 Add `SendTo` enum/type: `'PURCHASER' | 'RECIPIENT'`
  - [x] 1.4 Update or create interface for delivery options

- [x] 2.0 Create WhatsApp utility functions
  - [x] 2.1 Create `lib/utils/whatsapp.ts` file
  - [x] 2.2 Implement `formatPhoneNumber()` - normalize phone to international format (+62)
  - [x] 2.3 Implement `formatWhatsAppMessage()` - voucher message template with code, service, expiry
  - [x] 2.4 Implement `generateWhatsAppUrl()` - build wa.me URL with encoded message

- [x] 3.0 Update Checkout UI with delivery options
  - [x] 3.1 Read current `app/checkout/[id]/page.tsx` implementation
  - [x] 3.2 Update `CheckoutForm` interface with new fields: `recipientPhone`, `sendTo`, `deliveryMethod`
  - [x] 3.3 Add "Send To" toggle UI (Kirim ke Saya / Langsung ke Penerima)
  - [x] 3.4 Add "Recipient WhatsApp" phone input field (conditional visibility)
  - [x] 3.5 Add "Delivery Method" radio/toggle group (Email Only / WhatsApp Only / Both)
  - [x] 3.6 Implement conditional field visibility based on `sendTo` selection
  - [x] 3.7 Update react-hook-form validation rules for new required fields

- [x] 4.0 Create WhatsApp send API endpoint
  - [x] 4.1 Create `app/api/whatsapp/send-voucher/route.ts`
  - [x] 4.2 Define request body interface (recipientPhone, voucherCode, serviceName, etc.)
  - [x] 4.3 Implement POST handler that returns WhatsApp Web URL
  - [x] 4.4 Add input validation and error handling

- [x] 5.0 Update checkout submit logic
  - [x] 5.1 Determine delivery target based on `sendTo` value (purchaser vs recipient)
  - [x] 5.2 Update email sending to use correct target based on selection
  - [x] 5.3 Generate WhatsApp URL if deliveryMethod is 'whatsapp' or 'both'
  - [x] 5.4 Open WhatsApp Web in new tab after successful payment
  - [x] 5.5 Store delivery preferences in success state for display

- [x] 6.0 Update Success Page with manual resend options
  - [x] 6.1 Add state to store delivery info (phone, email, method)
  - [x] 6.2 Add "Kirim via WhatsApp" button that opens wa.me link
  - [x] 6.3 Add "Kirim Ulang via Email" button to resend email
  - [x] 6.4 Style buttons to match existing design system

- [x] 7.0 Testing & QA
  - [x] 7.1 Test checkout flow with sendTo = 'PURCHASER' and all delivery methods
  - [x] 7.2 Test checkout flow with sendTo = 'RECIPIENT' and all delivery methods
  - [x] 7.3 Test WhatsApp URL opens correctly (desktop & mobile simulation)
  - [x] 7.4 Test email delivery still works correctly
  - [x] 7.5 Test form validation for phone number format
  - [x] 7.6 Run TypeScript type check (`bunx tsc --noEmit`) ✅ PASSED

- [ ] 8.0 Git commit and merge
  - [ ] 8.1 Run `git status` to review all changes
  - [ ] 8.2 Stage all relevant files with `git add`
  - [ ] 8.3 Commit with message: `feat: add voucher delivery via WhatsApp and Email options`
  - [ ] 8.4 Merge feature branch to master (if approved)

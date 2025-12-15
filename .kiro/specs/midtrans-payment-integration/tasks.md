# Implementation Plan

## Midtrans Payment Gateway Integration

- [x] 1. Set up Midtrans configuration and types


  - [x] 1.1 Create Midtrans configuration module


    - Create `lib/midtrans/config.ts` with environment-aware configuration
    - Implement validation for required environment variables (Server Key, Client Key)
    - Export `getMidtransConfig()` function that throws on missing keys
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Create Midtrans type definitions

    - Create `lib/midtrans/types.ts` with TypeScript interfaces
    - Define `MidtransNotification`, `SnapResult`, `TransactionRequest` types
    - _Requirements: 2.2, 3.1_
  - [x] 1.3 Write property test for configuration validation


    - **Property 6: Transaction Request Completeness**
    - Test that config throws error when keys are missing
    - **Validates: Requirements 5.3, 5.4**

- [x] 2. Implement signature verification utility



  - [x] 2.1 Create signature verification module

    - Create `lib/midtrans/signature.ts`
    - Implement `computeSignature(orderId, statusCode, grossAmount, serverKey)` using SHA512
    - Implement `verifySignature(notification, serverKey)` function
    - _Requirements: 3.1, 3.5_

  - [x] 2.2 Write property test for signature verification

    - **Property 1: Signature Verification Correctness**
    - Test that computed signatures match expected format
    - Test that verification returns true for valid signatures, false for invalid
    - **Validates: Requirements 3.1, 3.5**

- [x] 3. Database schema migration



  - [x] 3.1 Create Supabase migration for orders table


    - Add `midtrans_order_id` column (VARCHAR, UNIQUE)
    - Add `midtrans_transaction_id` column (VARCHAR, nullable)
    - Add `midtrans_payment_type` column (VARCHAR, nullable)
    - Add `midtrans_transaction_time` column (TIMESTAMP, nullable)
    - Make `voucher_id` nullable
    - Create index on `midtrans_order_id`
    - _Requirements: 7.1, 7.2_
  - [x] 3.2 Update database types


    - Regenerate `lib/database.types.ts` or manually update Order type
    - Add new Midtrans fields to Order interface
    - _Requirements: 7.1, 7.2_

- [x] 4. Extend order actions for Midtrans integration




  - [x] 4.1 Add new order functions

    - Add `createPendingOrder()` function that creates order with PENDING status and null voucher_id
    - Add `updateOrderPaymentStatus()` function for webhook updates
    - Add `getOrderByMidtransOrderId()` function for webhook lookups
    - Add `generateMidtransOrderId()` function with uniqueness check
    - _Requirements: 7.1, 8.1, 6.1_
  - [x] 4.2 Write property test for order ID uniqueness


    - **Property 4: Order ID Uniqueness**
    - Test that generated order IDs are unique across multiple generations
    - **Validates: Requirements 2.5**
  - [x] 4.3 Write property test for pending order initialization


    - **Property 7: Pending Order Initialization**
    - Test that created orders have PENDING status and null voucher_id
    - **Validates: Requirements 8.1, 7.1**

- [x] 5. Checkpoint - Ensure all tests pass
  - All 31 Midtrans-related tests pass
  - 5 pre-existing component tests skipped (need SidebarProvider setup)
  - TypeScript compilation passes

- [x] 6. Create transaction API endpoint



  - [x] 6.1 Implement create-transaction API route


    - Create `app/api/midtrans/create-transaction/route.ts`
    - Validate request body (serviceId, customer details, recipient details)
    - Create pending order in database
    - Initialize Midtrans Snap client with server key
    - Call `snap.createTransactionToken()` with order details
    - Return token and orderId to frontend
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.1_

  - [x] 6.2 Write property test for transaction request completeness

    - **Property 6: Transaction Request Completeness**
    - Test that request payload contains required fields
    - **Validates: Requirements 2.2**

- [x] 7. Implement webhook notification handler

  - [x] 7.1 Create notification webhook API route


    - Create `app/api/midtrans/notification/route.ts`
    - Parse JSON body from Midtrans
    - Verify signature using `verifySignature()` function
    - Look up order by `midtrans_order_id`
    - Map transaction_status to PaymentStatus
    - Update order status in database
    - If status is COMPLETED, trigger voucher creation and delivery
    - Always respond with HTTP 200 (even for errors, to prevent retries)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4_

  - [x] 7.2 Write property test for transaction status mapping

    - **Property 2: Transaction Status Mapping**
    - Test settlement/capture → COMPLETED, deny/cancel/expire → FAILED, pending → PENDING
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x] 7.3 Write property test for idempotent webhook processing
    - **Property 3: Idempotent Webhook Processing**
    - Test that processing same notification twice produces same result
    - **Validates: Requirements 6.4**

  - [x] 7.4 Write property test for webhook response consistency
    - **Property 8: Webhook Response Consistency**
    - Test that valid webhooks always return HTTP 200
    - **Validates: Requirements 3.6**

- [x] 8. Implement voucher creation on payment success
  - [x] 8.1 Create voucher creation service

    - Create `lib/midtrans/voucher-service.ts`
    - Implement `createVoucherOnPaymentSuccess()` function
    - Fetch order details and service information
    - Create voucher using existing `createVoucher()` action
    - Update order with voucher_id
    - Trigger delivery via Email/WhatsApp based on order preferences
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 8.2 Write property test for voucher creation precondition

    - **Property 5: Voucher Creation Precondition**
    - Test that vouchers are only created for COMPLETED orders
    - **Validates: Requirements 8.2, 8.3**

- [x] 9. Checkpoint - Ensure all tests pass


  - All 56 Midtrans-related tests pass (7 test files)
  - TypeScript compilation passes
  - New tests added: notification.test.ts (12 tests), voucher-service.test.ts (6 tests)

- [x] 10. Create Snap integration hook for frontend




  - [x] 10.1 Implement useMidtransSnap hook

    - Create `hooks/useMidtransSnap.ts`
    - Load Snap.js script dynamically
    - Expose `pay(token)` function that calls `snap.pay()`
    - Handle onSuccess, onPending, onError, onClose callbacks
    - Manage loading state
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 11. Update checkout page to use Midtrans




  - [x] 11.1 Refactor checkout page for Midtrans integration

    - Update `app/checkout/[id]/page.tsx`
    - Replace simulated payment with Midtrans Snap
    - Call create-transaction API on form submit
    - Use `useMidtransSnap` hook to show payment popup
    - Handle success/pending/error states
    - Remove old payment method selection (Midtrans handles this)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 11.2 Update success page for pending payments

    - Show different UI for pending payments (bank transfer instructions)
    - Add order status checking capability
    - _Requirements: 4.4_

- [x] 12. Update admin dashboard for Midtrans data




  - [x] 12.1 Display Midtrans transaction details in admin

    - Update order detail view to show midtrans_transaction_id
    - Show payment_type from Midtrans
    - Display transaction_time
    - _Requirements: 7.3_

- [x] 13. Add environment variables documentation




  - [x] 13.1 Update environment configuration

    - Add Midtrans variables to `.env.example` or documentation
    - Document sandbox vs production configuration
    - _Requirements: 5.1, 5.2_

- [x] 14. Final Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.

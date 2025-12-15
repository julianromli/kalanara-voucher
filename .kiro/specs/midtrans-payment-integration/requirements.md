# Requirements Document

## Introduction

Dokumen ini mendefinisikan requirements untuk integrasi Midtrans Payment Gateway ke dalam platform Kalanara Spa Voucher. Integrasi ini akan menggantikan simulasi pembayaran yang ada dengan payment gateway real yang mendukung berbagai metode pembayaran populer di Indonesia (kartu kredit/debit, transfer bank, e-wallet seperti GoPay, OVO, DANA, dll).

Midtrans Snap akan digunakan sebagai interface pembayaran karena menyediakan popup yang user-friendly dan sudah handle berbagai metode pembayaran dalam satu interface.

## Glossary

- **Midtrans**: Payment gateway provider terkemuka di Indonesia yang menyediakan berbagai metode pembayaran
- **Snap**: Produk Midtrans yang menyediakan payment popup/redirect dengan UI yang sudah jadi
- **Snap Token**: Token unik yang di-generate server-side untuk memulai transaksi Snap
- **Server Key**: API key rahasia untuk autentikasi server-to-server dengan Midtrans
- **Client Key**: API key publik untuk inisialisasi Snap.js di frontend
- **Webhook/Notification**: HTTP POST request dari Midtrans ke server merchant saat status transaksi berubah
- **Order ID**: Identifier unik untuk setiap transaksi, harus unique di sistem Midtrans
- **Transaction Status**: Status pembayaran dari Midtrans (pending, settlement, capture, deny, cancel, expire, refund)
- **Gross Amount**: Total nilai transaksi dalam Rupiah (tanpa desimal)

## Requirements

### Requirement 1

**User Story:** As a customer, I want to pay for vouchers using various Indonesian payment methods, so that I can complete purchases conveniently with my preferred payment option.

#### Acceptance Criteria

1. WHEN a customer clicks the pay button on checkout THEN the Checkout_System SHALL display the Midtrans Snap payment popup within 3 seconds
2. WHEN the Snap popup is displayed THEN the Checkout_System SHALL show available payment methods including credit card, bank transfer, and e-wallets
3. WHEN a customer selects a payment method and completes payment THEN the Checkout_System SHALL receive payment confirmation and proceed to voucher creation
4. WHEN a customer closes the Snap popup without completing payment THEN the Checkout_System SHALL maintain the checkout state and allow retry

### Requirement 2

**User Story:** As a system, I want to securely create payment transactions on the server, so that payment data is protected and transactions are properly authenticated.

#### Acceptance Criteria

1. WHEN a checkout form is submitted THEN the Payment_API SHALL create a Snap transaction token using the Midtrans Server Key
2. WHEN creating a transaction token THEN the Payment_API SHALL include order_id, gross_amount, and customer_details in the request
3. WHEN the Midtrans API returns a token THEN the Payment_API SHALL return the token to the frontend within 5 seconds
4. WHEN the Midtrans API returns an error THEN the Payment_API SHALL return an appropriate error message to the frontend
5. WHEN generating order_id THEN the Payment_API SHALL create a unique identifier that has not been used in previous transactions

### Requirement 3

**User Story:** As a system, I want to receive and process payment notifications from Midtrans, so that order statuses are accurately updated based on actual payment results.

#### Acceptance Criteria

1. WHEN Midtrans sends a payment notification webhook THEN the Webhook_Handler SHALL validate the notification signature using SHA512 hash
2. WHEN a valid notification with status "settlement" or "capture" is received THEN the Webhook_Handler SHALL update the order status to COMPLETED
3. WHEN a valid notification with status "deny", "cancel", or "expire" is received THEN the Webhook_Handler SHALL update the order status to FAILED
4. WHEN a valid notification with status "pending" is received THEN the Webhook_Handler SHALL maintain the order status as PENDING
5. WHEN an invalid signature is detected THEN the Webhook_Handler SHALL reject the notification and log the security event
6. WHEN a notification is processed successfully THEN the Webhook_Handler SHALL respond with HTTP status 200

### Requirement 4

**User Story:** As a customer, I want to see clear feedback during the payment process, so that I understand what is happening and can take appropriate action.

#### Acceptance Criteria

1. WHEN payment is being processed THEN the Checkout_UI SHALL display a loading indicator with appropriate message
2. WHEN payment succeeds THEN the Checkout_UI SHALL display a success message and voucher details
3. WHEN payment fails THEN the Checkout_UI SHALL display an error message with option to retry
4. WHEN payment is pending (e.g., waiting for bank transfer) THEN the Checkout_UI SHALL display pending status with payment instructions

### Requirement 5

**User Story:** As a developer, I want Midtrans configuration to be environment-aware, so that I can safely test in sandbox and deploy to production.

#### Acceptance Criteria

1. WHEN the application runs in development THEN the Midtrans_Config SHALL use sandbox API endpoints and keys
2. WHEN the application runs in production THEN the Midtrans_Config SHALL use production API endpoints and keys
3. WHEN Server Key is missing from environment THEN the Midtrans_Config SHALL throw a configuration error at startup
4. WHEN Client Key is missing from environment THEN the Midtrans_Config SHALL throw a configuration error at startup

### Requirement 6

**User Story:** As a system, I want to handle payment edge cases gracefully, so that the system remains reliable under various conditions.

#### Acceptance Criteria

1. WHEN a duplicate order_id is detected THEN the Payment_API SHALL generate a new unique order_id and retry
2. WHEN Midtrans API is unreachable THEN the Payment_API SHALL return a timeout error after 30 seconds
3. WHEN a webhook is received for a non-existent order THEN the Webhook_Handler SHALL log the event and respond with HTTP 200
4. WHEN multiple webhooks are received for the same transaction THEN the Webhook_Handler SHALL process idempotently based on order_id

### Requirement 7

**User Story:** As a system administrator, I want to track payment transactions in the database, so that I can reconcile payments and troubleshoot issues.

#### Acceptance Criteria

1. WHEN a Snap token is created THEN the Order_System SHALL store the midtrans_order_id in the orders table
2. WHEN a payment notification is received THEN the Order_System SHALL store the transaction_id and transaction_status from Midtrans
3. WHEN querying order details THEN the Admin_Dashboard SHALL display the Midtrans transaction_id for reference

### Requirement 8

**User Story:** As a system, I want to create vouchers only after successful payment confirmation, so that vouchers are not issued for unpaid orders.

#### Acceptance Criteria

1. WHEN a customer initiates checkout THEN the Checkout_System SHALL create an order with PENDING status before showing payment popup
2. WHEN payment is confirmed via webhook with status "settlement" or "capture" THEN the Voucher_System SHALL create the voucher and associate it with the order
3. WHEN payment fails or expires THEN the Voucher_System SHALL NOT create any voucher for that order
4. WHEN voucher is created after payment success THEN the Delivery_System SHALL send voucher via selected delivery method (Email/WhatsApp)

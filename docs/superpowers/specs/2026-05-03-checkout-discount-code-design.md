# Checkout Discount Code Design

## Summary
Add a checkout discount-code feature that lets customers enter one promo code during checkout and see the final price decrease before payment. The app remains the source of truth for validation and pricing, stores a full discount snapshot on orders and order items, and sends the discounted amount to Scalev using a valid order-level discount mechanism.

## Goal
Implement an MVP discount-code system that supports:

- one discount code per checkout
- order-level discounts
- both fixed-amount and percentage discounts
- active date windows
- global usage limits
- per-customer usage limits
- admin management UI

The feature must ensure that:

- the server always recalculates the discount
- `services.price` remains the catalog base price
- pending or failed payments do not consume promo quota
- the amount shown in checkout, stored in the order, and sent to Scalev stays consistent

## Scope
In scope:

- checkout UI for single-item and cart checkout
- server-side discount validation
- order and order-item discount snapshots
- Scalev payment creation updates
- payment-success redemption finalization
- admin UI to create, edit, activate, and deactivate discount codes
- focused automated tests and manual checkout verification

Out of scope for this MVP:

- multiple discount codes in one checkout
- service-specific promo eligibility
- minimum subtotal rules
- percentage discount caps
- bulk promo import
- promo analytics dashboards

## Business Rules

### Discount scope
- A discount code applies to the full checkout total, not to specific services.

### Discount formats
- Support `FIXED_AMOUNT` and `PERCENTAGE`.
- The final total cannot go below `0`.

### Usage limits
- Each code can have a global usage limit.
- Each code can have a per-customer usage limit.
- A customer is treated as the same person if the same code was successfully used before by the same email or the same phone number.

### Active period
- Codes can have a start time and an end time.
- A code is valid only when the current server time is within that window.

### Redemption moment
- A code counts as used only after payment succeeds.
- Pending, failed, expired, or cancelled payments do not consume usage quota.

### Checkout stacking
- Only one code can be active in one checkout.

## Architecture
The feature is split into two responsibilities:

### 1. Discount validation and pricing
This layer validates the code and computes:

- `subtotal_amount`
- `discount_amount`
- `total_amount`

This layer is fully server-side and uses local app data as the source of truth.

### 2. Payment creation
This layer persists the pricing snapshot to `orders` and `order_items`, then creates the payment in Scalev using the discounted order amount.

The client may submit a `discountCode`, but the client never submits trusted price numbers.

## Checkout Flow

1. The customer enters a discount code in checkout.
2. The client submits checkout data plus `discountCode` to `app/api/scalev/create-payment/route.ts`.
3. The server validates the checkout payload as it does today.
4. The server loads the selected services from the database and computes `subtotal_amount` from `services.price`.
5. If a discount code is present, the server normalizes and validates it.
6. The server computes `discount_amount` and final `total_amount`.
7. The server creates the local order with full pricing snapshot fields.
8. The server allocates the total discount across `order_items`.
9. The server creates a `PENDING` discount redemption record for auditability.
10. The server creates the Scalev order with the same discounted total using an order-level discount field.
11. If the payment later succeeds, webhook or reconciliation marks the redemption as `SUCCEEDED`.
12. If the payment fails, expires, or is cancelled, the redemption is marked `VOID`.

## Data Model

### New table: `discount_codes`
Stores promo code definitions.

Suggested columns:

- `id`
- `code`
- `is_active`
- `discount_type`
- `discount_value`
- `starts_at`
- `ends_at`
- `max_total_uses`
- `max_uses_per_customer`
- `created_at`
- `updated_at`

Recommended constraints:

- unique index on normalized code
- check constraints for non-negative numeric values
- explicit enum or constrained text for `discount_type`

### New table: `discount_code_redemptions`
Stores usage history and supports limit checks plus auditing.

Suggested columns:

- `id`
- `discount_code_id`
- `order_id`
- `customer_email_normalized`
- `customer_phone_normalized`
- `status`
- `discount_snapshot_type`
- `discount_snapshot_value`
- `subtotal_amount`
- `discount_amount`
- `final_total_amount`
- `redeemed_at`
- `created_at`

Recommended status values:

- `PENDING`
- `SUCCEEDED`
- `VOID`

Usage limits are computed only from `SUCCEEDED` rows.

### Changes to `orders`
Current Supabase schema already contains `total_amount`, but does not contain discount fields. Add:

- `subtotal_amount`
- `discount_code_id`
- `discount_code`
- `discount_type_snapshot`
- `discount_value_snapshot`
- `discount_amount`

Field semantics:

- `subtotal_amount` = sum of base service prices before discount
- `discount_amount` = actual order-level discount applied
- `total_amount` = final payable amount after discount

This keeps existing consumers of `orders.total_amount` aligned with the amount the customer actually pays.

### Changes to `order_items`
Current schema only stores `unit_price`. Add:

- `original_unit_price`
- `discount_amount`
- `final_unit_price`

Compatibility decision:

- keep `unit_price` as the final unit price to avoid breaking downstream logic that already reads it
- use `original_unit_price` to preserve the catalog price snapshot
- use `final_unit_price` as an explicit mirror during migration and transition logic if clearer for code readability

If implementation prefers less duplication, `unit_price` and `final_unit_price` can be consolidated later, but for this MVP the design keeps the intent explicit.

## Discount Calculation

### Base totals
- `subtotal_amount` is computed only from database service prices.
- The client display is only advisory.

### Fixed amount
- `discount_amount = discount_value`
- clamp to `subtotal_amount`

### Percentage
- `discount_amount = round(subtotal_amount * percentage / 100)`
- clamp to `subtotal_amount`

### Item allocation
Because the promo applies at the order level, item-level discounts are stored as an allocation snapshot.

Recommended allocation rule:

- allocate proportionally to each item's original price
- use integer rounding in IDR
- assign the rounding remainder to the last item so item totals match the exact order discount

## Server Validation Rules
Discount validation must happen in the checkout payment route or a pricing helper called by it.

Validation order:

1. Normalize the submitted code.
2. Load the code by normalized key.
3. Reject if missing or inactive.
4. Reject if outside the active time window.
5. Count `SUCCEEDED` redemptions for the code and reject if global limit is exhausted.
6. Count `SUCCEEDED` redemptions for the code where email or phone matches the current customer and reject if the per-customer limit is exhausted.
7. Compute the discount and final totals.

Normalization rules:

- normalize code to a canonical uppercase trimmed form
- normalize email to trimmed lowercase
- normalize phone to the same canonical server format already used for checkout and Scalev

## Scalev Integration
The project currently syncs service prices from local `services.price` into Scalev product variants and creates Scalev orders using `ordervariants`. That means local discount math is not enough by itself; the discounted amount must also be represented in the Scalev order payload.

### Planned contract
- keep sending `ordervariants`
- add an order-level discount field to the Scalev order payload, specifically `product_discount`
- include discount metadata such as code, subtotal, discount amount, and final total for reconciliation

### Fail-closed behavior
If Scalev rejects the discounted payload:

- do not silently continue with the full non-discounted price
- mark the local order as failed
- return a checkout error so the customer never pays the wrong amount

This is safer than allowing app and gateway totals to diverge.

## Payment Lifecycle

### At order creation time
- create the local `orders` row with discount snapshot
- create `order_items` with allocated discount snapshot
- create `discount_code_redemptions` row with `PENDING`

### On payment success
- mark the order completed through the existing Scalev flow
- transition the related redemption from `PENDING` to `SUCCEEDED`
- perform this transition idempotently so duplicate webhook or reconcile events do not double-count usage

### On payment failure or expiry
- transition the related redemption from `PENDING` to `VOID`

## Checkout UI

### Customer flow
- Add a `Kode diskon` input in checkout summary for single-item and cart checkout.
- Provide an apply action.
- Show a successful applied state with the code label and the discount amount.
- Allow removing the code before submitting.

### Pricing display
When a valid code is active, show:

- subtotal
- discount
- final total

When no code is active, show the existing simple total presentation.

### Error messaging
Use specific messages for:

- invalid code
- inactive code
- code not yet started
- expired code
- global usage exhausted
- customer already used the code

If payment creation fails because the gateway rejects the discount payload, show a general checkout error and do not redirect to payment.

## Admin UI
Add a minimal admin interface for promo-code management.

MVP capabilities:

- list codes
- create code
- edit code
- activate or deactivate code

MVP form fields:

- code
- discount type
- discount value
- active flag
- start date
- end date
- max total uses
- max uses per customer

List view should show:

- code
- active state
- validity window
- basic usage count based on successful redemptions

## Reporting and Voucher Impact
The current system stores voucher amounts and item prices. After this feature:

- `orders.total_amount` should represent the amount actually paid
- vouchers created from `order_items` should use final item price snapshots
- revenue and order summaries should reflect the discounted amount, not the catalog subtotal

## Testing

### Unit tests
Add focused tests for:

- fixed-amount discounts
- percentage discounts
- clamping at zero
- proportional item allocation
- rounding remainder handling
- code validity windows
- global usage limit checks
- per-customer usage limit checks

### API tests
Add or update route tests for:

- checkout without promo
- checkout with valid promo
- invalid promo
- expired promo
- exhausted global limit
- exhausted per-customer limit
- gateway rejection of discounted payload

### Payment lifecycle tests
Add tests for:

- `PENDING -> SUCCEEDED` redemption transition
- `PENDING -> VOID` redemption transition
- idempotent repeated success handling

### Manual verification
Verify in browser:

1. Apply valid code in single checkout.
2. Apply valid code in cart checkout.
3. Remove code before submit.
4. Complete payment successfully and confirm quota is consumed.
5. Let payment fail or expire and confirm quota is not consumed.
6. Verify order success page and voucher values reflect the discounted amounts.

## Files Likely to Change

- `app/checkout/[id]/checkout-page-client.tsx`
- `app/checkout/cart/cart-checkout-client.tsx`
- `app/api/scalev/create-payment/route.ts`
- `app/api/scalev/create-payment/route.test.ts`
- `lib/scalev/types.ts`
- `lib/scalev/client.ts`
- `lib/actions/orders.ts`
- `lib/actions/services.ts`
- `lib/payment/voucher-service.ts`
- `lib/database.types.ts`
- admin UI files for promo-code management
- Supabase migration files for new tables and columns

## Acceptance Criteria

- Customers can apply one discount code during checkout and see the total decrease.
- The server remains the source of truth for all discount validation and calculations.
- The final amount stored in `orders.total_amount` matches the final amount sent to Scalev.
- Promo usage is only counted after successful payment.
- Failed or expired payments do not consume promo quota.
- Voucher and order snapshots preserve both original and discounted values.
- Admins can create and manage discount codes without editing the database manually.

## Explicit Decisions

- Order-level promo only for MVP
- One code per checkout
- No minimum subtotal rule in MVP
- No percentage cap in MVP
- No service-specific promo eligibility in MVP
- `orders.total_amount` represents the final payable amount
- Gateway discount rejection fails the checkout instead of falling back to full price

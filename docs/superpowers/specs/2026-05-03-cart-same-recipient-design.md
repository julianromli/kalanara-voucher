# Cart Same Recipient UX Design

## Summary
Improve the cart checkout experience for `Gunakan penerima yang sama` so the UI matches the underlying behavior. When the toggle is enabled, voucher 1 becomes the only editable source of truth for recipient data, and voucher 2+ stop pretending to be independent forms.

## Problem
The current cart checkout syncs recipient data from voucher 1 to the remaining vouchers, but the UI still renders full editable forms for every voucher. This creates a mismatch:

- voucher 2+ look editable
- voucher 2+ can be overwritten by later edits on voucher 1
- users have to parse repeated form sections even when the data is intentionally shared

This makes the flow feel inconsistent and increases the chance of confusion or accidental data loss.

## Goal
Make `Gunakan penerima yang sama` feel like an explicit "master recipient" mode:

- voucher 1 is the master editable form
- voucher 2+ are shown as summaries, not editable forms
- users understand that all secondary vouchers follow voucher 1
- turning the toggle off restores full per-voucher editing without losing the synced values

## Scope
This design only covers the `sameRecipient` interaction in cart checkout.

In scope:

- `app/checkout/cart/cart-checkout-client.tsx`
- related copy, layout hierarchy, and interaction states
- focused test updates for the same-recipient UI behavior

Out of scope:

- full cart checkout redesign
- single-item checkout changes
- success page redesign
- payment flow changes

## Proposed UX

### Default state
When `Gunakan penerima yang sama` is off:

- every voucher card remains fully editable
- each voucher can have its own recipient, message, delivery target, and delivery method

### Same recipient enabled
When `Gunakan penerima yang sama` is on:

- voucher 1 becomes the master card
- voucher 1 remains fully editable
- voucher 2+ collapse into compact summary cards
- summary cards show:
  - recipient name
  - delivery target
  - delivery method
  - sender message, if present
- summary cards include a small visual indicator such as `Mengikuti Voucher 1`

### Same recipient disabled again
When the toggle is turned off after being on:

- voucher 2+ expand back into full editable cards
- their last synced values remain intact
- no field should reset unexpectedly

## Content and Copy

### Toggle label
Keep the current label:

- `Gunakan penerima yang sama`

### Helper copy
Add a clearer explanation under the toggle or near the first voucher card:

- `Semua voucher di bawah mengikuti Voucher 1.`

### Master card label
Voucher 1 should receive a stronger heading or badge, for example:

- `Voucher 1`
- `Data utama penerima`

The purpose is to make the information hierarchy obvious without introducing a new complex concept.

### Summary badge
Voucher 2+ should show a small badge or inline text:

- `Mengikuti Voucher 1`

## Interaction Details

### Data model behavior
The existing sync behavior can remain conceptually the same:

- voucher 1 drives recipient-related values for voucher 2+
- the mirrored fields remain:
  - `recipientName`
  - `recipientEmail`
  - `recipientPhone`
  - `senderMessage`
  - `sendTo`
  - `deliveryMethod`

The UI should simply stop exposing voucher 2+ as editable while this mode is active.

### Card layout
When enabled:

- voucher 1 stays in the current full card layout
- voucher 2+ render a smaller, lighter card treatment
- the summary card should not use disabled inputs

Disabled inputs are visually noisy and imply broken functionality. A summary card is clearer and more honest.

### Accessibility
When the toggle is enabled or disabled:

- screen-reader users should receive an announcement that voucher 2+ are now following voucher 1, or that independent editing has been restored
- summary cards should remain readable in the accessibility tree as plain content, not hidden state

## Error Handling and Validation

- validation continues to be enforced through voucher 1 while same-recipient mode is active
- voucher 2+ should not surface duplicate validation messages because they are no longer directly editable in this state
- when same-recipient mode is turned off, validation returns to per-voucher behavior

## Testing
Add or update focused coverage for these cases:

1. With the toggle off, all voucher cards render editable fields.
2. With the toggle on, voucher 1 remains editable and voucher 2+ collapse into summaries.
3. Editing voucher 1 updates the secondary summaries.
4. Turning the toggle off restores editable secondary cards without losing the last synced values.
5. Existing submit behavior continues to send the correct line-item payload.

## Implementation Notes

- Keep this change isolated to cart same-recipient behavior.
- Reuse the existing visual language of checkout cards instead of introducing a new component system.
- Prefer a small internal helper/component boundary if the current file becomes harder to read, for example separating:
  - master voucher card rendering
  - secondary voucher summary rendering

## Success Criteria

- Users no longer perceive voucher 2+ as independently editable while same-recipient mode is active.
- The checkout page becomes easier to scan when buying multiple vouchers for one recipient.
- The behavior of the UI clearly matches the actual form synchronization logic.

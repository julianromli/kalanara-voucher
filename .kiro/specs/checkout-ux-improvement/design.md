# Design Document

## Overview

This design document outlines the UX improvements for the checkout page form flow. The primary goal is to reduce friction in the checkout process by making email fields conditional based on delivery method selection, while prioritizing WhatsApp as the primary delivery channel for the Indonesian market.

The improvement involves restructuring the form to:
1. Remove email from the Recipient Details section
2. Add conditional email fields to the Voucher Delivery Options section
3. Set WhatsApp as the default delivery method
4. Implement smart field visibility based on "Send To" and "Delivery Method" selections

## Architecture

### Component Structure

The checkout page is a client component (`app/checkout/[id]/page.tsx`) that uses React Hook Form for form management. The architecture follows these patterns:

```
CheckoutPage (Client Component)
├── Form State Management (react-hook-form)
├── Form Sections
│   ├── Customer Details (Your Details)
│   ├── Recipient Details (Modified)
│   ├── Voucher Delivery Options (Enhanced)
│   └── Payment Method
├── Order Summary (Sticky Sidebar)
└── Success State (Post-Purchase)
```

### State Management

- **Form State**: Managed by `react-hook-form` with `useForm` hook
- **Watched Fields**: `sendTo`, `deliveryMethod` (for conditional rendering)
- **Validation**: Real-time validation with `trigger()` for immediate feedback
- **Submission**: Async handler with loading state

## Components and Interfaces

### Modified Form Interface

```typescript
interface CheckoutForm {
  // Customer Details
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Recipient Details (email removed)
  recipientName: string;
  recipientPhone: string;
  senderMessage: string;
  
  // Delivery Options (email added conditionally)
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
  recipientEmail?: string; // Conditional field
  
  // Payment
  paymentMethod: PaymentMethod;
}
```

### Conditional Field Logic

```typescript
// Email field visibility logic
const showRecipientEmail = 
  (deliveryMethod === DeliveryMethod.EMAIL || deliveryMethod === DeliveryMethod.BOTH) &&
  sendTo === SendTo.RECIPIENT;

// Email value determination
const effectiveRecipientEmail = 
  sendTo === SendTo.PURCHASER 
    ? customerEmail 
    : recipientEmail;
```

### Form Section Components

#### 1. Recipient Details Section (Modified)
- **Fields**: Name, WhatsApp, Message (optional)
- **Removed**: Email field
- **Validation**: Name and WhatsApp required

#### 2. Voucher Delivery Options Section (Enhanced)
- **Send To Toggle**: Purchaser vs Recipient (existing)
- **Delivery Method**: WhatsApp (default), Email, Both
- **Conditional Email Field**: Shows when:
  - Delivery method is Email or Both, AND
  - Send To is "Direct to Recipient"
- **Field Placement**: Email field appears below delivery method selection

## Data Models

### Existing Types (No Changes Required)

```typescript
enum DeliveryMethod {
  EMAIL = "EMAIL",
  WHATSAPP = "WHATSAPP",
  BOTH = "BOTH",
}

enum SendTo {
  PURCHASER = "PURCHASER",
  RECIPIENT = "RECIPIENT",
}
```

### Form Validation Schema

```typescript
// Recipient Details validation
recipientName: { required: true }
recipientPhone: { 
  required: "Nomor WhatsApp wajib diisi",
  pattern: {
    value: /^(\+62|62|0)[\d\s-]{8,14}$/,
    message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx"
  }
}

// Conditional email validation
recipientEmail: {
  required: showRecipientEmail,
  pattern: showRecipientEmail ? /^\S+@\S+$/i : undefined
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Email field visibility consistency
*For any* combination of sendTo and deliveryMethod values, the email field visibility should match the expected state: visible when (deliveryMethod is EMAIL or BOTH) AND (sendTo is RECIPIENT), hidden otherwise
**Validates: Requirements 2.2, 2.3, 4.2, 4.3**

### Property 2: Email validation and visibility coupling
*For any* form state, email validation should be required if and only if the email field is visible, and the field should be visible if and only if (deliveryMethod is EMAIL or BOTH) AND (sendTo is RECIPIENT)
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Email value resolution
*For any* valid form submission, the effective recipient email should equal customerEmail when sendTo is PURCHASER, and recipientEmail when sendTo is RECIPIENT
**Validates: Requirements 4.1**

### Property 4: Form section data persistence
*For any* sequence of user interactions changing delivery options, all previously entered data in other form sections should remain unchanged
**Validates: Requirements 1.4**

### Property 5: Recipient details validation without email
*For any* form state, the Recipient Details section should be valid when recipientName and recipientPhone are provided, regardless of whether recipientEmail is provided
**Validates: Requirements 1.3**

### Property 6: Format validation consistency
*For any* invalid input format (email or WhatsApp number), the system should display a specific validation message with format guidance
**Validates: Requirements 5.2, 5.3**

### Property 7: Validation error clearing
*For any* field with validation errors, correcting the field value to a valid format should immediately remove the error message
**Validates: Requirements 5.4**

### Property 8: Validation error handling on submission
*For any* form submission attempt with validation errors, the system should prevent submission, display error messages for all invalid fields, and focus the first error field
**Validates: Requirements 5.1, 5.5**

### Property 9: Delivery option state transitions
*For any* change in sendTo or deliveryMethod values, the email field visibility and validation requirements should update immediately to match the new state
**Validates: Requirements 2.4, 2.5, 4.4**

## Error Handling

### Validation Error States

1. **Missing Required Fields**
   - Display inline error message below field
   - Apply error styling (red border)
   - Prevent form submission

2. **Invalid Format Errors**
   - Email: "Please enter a valid email address"
   - WhatsApp: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx"
   - Show format hint below field

3. **Dynamic Validation Updates**
   - Clear errors when field becomes optional
   - Apply validation when field becomes required
   - Re-validate on blur events

### Error Recovery

- **Field Correction**: Immediate error clearing on valid input
- **Focus Management**: Auto-focus first error field on submit
- **State Preservation**: Maintain valid field values during validation changes

## Testing Strategy

### Unit Testing

Unit tests will verify specific form behaviors and edge cases:

1. **Field Visibility Tests**
   - Email field hidden when WhatsApp-only selected
   - Email field shown when Email/Both selected with Recipient
   - Email field hidden when Send to Me selected

2. **Validation Tests**
   - Required field validation for name and WhatsApp
   - Conditional email validation based on delivery method
   - Format validation for email and phone fields

3. **State Management Tests**
   - Form data persistence across option changes
   - Default values on initial load
   - Watched field updates trigger re-renders

### Property-Based Testing

Property-based tests will verify universal behaviors across all input combinations using **fast-check** library (JavaScript/TypeScript PBT framework). Each test will run a minimum of 100 iterations.

1. **Property Test: Email Field Visibility**
   - Generate random combinations of sendTo and deliveryMethod
   - Verify email field visibility matches expected logic
   - **Feature: checkout-ux-improvement, Property 1: Email field visibility consistency**

2. **Property Test: Email Validation and Visibility Coupling**
   - Generate random form states with various sendTo and deliveryMethod combinations
   - Verify email validation is required iff email field is visible
   - Verify field visibility matches the expected conditional logic
   - **Feature: checkout-ux-improvement, Property 2: Email validation and visibility coupling**

3. **Property Test: Email Value Resolution**
   - Generate random valid form submissions with different sendTo values
   - Verify effective email matches expected source (customer vs recipient)
   - **Feature: checkout-ux-improvement, Property 3: Email value resolution**

4. **Property Test: Form Section Data Persistence**
   - Generate random sequences of delivery option changes
   - Verify other form section data remains unchanged
   - **Feature: checkout-ux-improvement, Property 4: Form section data persistence**

5. **Property Test: Recipient Details Validation Without Email**
   - Generate random recipient names and WhatsApp numbers
   - Verify Recipient Details section validates successfully without email
   - **Feature: checkout-ux-improvement, Property 5: Recipient details validation without email**

6. **Property Test: Format Validation Consistency**
   - Generate random invalid email and WhatsApp formats
   - Verify appropriate validation messages appear with format guidance
   - **Feature: checkout-ux-improvement, Property 6: Format validation consistency**

7. **Property Test: Validation Error Clearing**
   - Generate random fields with errors, then correct them
   - Verify error messages clear immediately upon correction
   - **Feature: checkout-ux-improvement, Property 7: Validation error clearing**

8. **Property Test: Validation Error Handling on Submission**
   - Generate random form states with various validation errors
   - Verify submission is prevented, errors are displayed, and focus moves to first error
   - **Feature: checkout-ux-improvement, Property 8: Validation error handling on submission**

9. **Property Test: Delivery Option State Transitions**
   - Generate random sequences of sendTo and deliveryMethod changes
   - Verify email field visibility and validation update immediately
   - **Feature: checkout-ux-improvement, Property 9: Delivery option state transitions**

### Integration Testing

Integration tests will verify the complete checkout flow:

1. **Complete Purchase Flow**
   - Fill form with WhatsApp-only delivery
   - Submit and verify voucher creation
   - Confirm WhatsApp URL generation

2. **Email Delivery Flow**
   - Select Email delivery method
   - Fill conditional email field
   - Submit and verify email API call

3. **Send To Toggle Flow**
   - Toggle between Purchaser and Recipient
   - Verify email field visibility changes
   - Verify correct email used in submission

### Manual Testing Checklist

- [ ] WhatsApp is default delivery method on page load
- [ ] Email field not visible in Recipient Details
- [ ] Email field appears when Email/Both selected
- [ ] Email field hidden when switching to WhatsApp-only
- [ ] Send to Me uses customer email automatically
- [ ] Validation errors clear when corrected
- [ ] Form submits successfully with WhatsApp-only
- [ ] Form submits successfully with Email delivery
- [ ] Mobile responsive layout works correctly
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader announces field changes

## Implementation Notes

### React Hook Form Integration

```typescript
// Watch for conditional rendering
const sendTo = watch("sendTo");
const deliveryMethod = watch("deliveryMethod");

// Compute visibility
const showRecipientEmail = 
  (deliveryMethod === DeliveryMethod.EMAIL || 
   deliveryMethod === DeliveryMethod.BOTH) &&
  sendTo === SendTo.RECIPIENT;

// Conditional registration
{showRecipientEmail && (
  <Input
    {...register("recipientEmail", {
      required: "Email wajib diisi untuk pengiriman email",
      pattern: {
        value: /^\S+@\S+$/i,
        message: "Format email tidak valid"
      }
    })}
  />
)}
```

### Default Values Update

```typescript
const { register, handleSubmit, watch, setValue } = useForm<CheckoutForm>({
  defaultValues: {
    paymentMethod: PaymentMethod.CREDIT_CARD,
    sendTo: SendTo.RECIPIENT,
    deliveryMethod: DeliveryMethod.WHATSAPP, // Changed from EMAIL
  },
});
```

### Submission Logic Update

```typescript
const onSubmit = async (data: CheckoutForm) => {
  // Determine effective email based on sendTo
  const targetEmail = data.sendTo === SendTo.PURCHASER 
    ? data.customerEmail 
    : data.recipientEmail || data.customerEmail; // Fallback for safety
  
  // Rest of submission logic...
};
```

### UI/UX Considerations

1. **Visual Hierarchy**
   - WhatsApp option styled as primary
   - Email field slides in smoothly when shown
   - Clear visual feedback for selected options

2. **Animation**
   - Smooth height transition for email field appearance
   - Fade-in animation for conditional fields
   - Respect `prefers-reduced-motion`

3. **Accessibility**
   - ARIA labels for conditional fields
   - Announce field visibility changes to screen readers
   - Maintain focus management during dynamic changes

4. **Mobile Optimization**
   - Touch-friendly radio buttons
   - Adequate spacing between options
   - Sticky order summary on mobile

## Migration Strategy

### Backward Compatibility

- Existing voucher records in database remain unchanged
- API endpoints continue to accept email fields
- No database schema changes required

### Deployment Steps

1. Update checkout page component
2. Test in staging environment
3. Monitor form submission success rates
4. Rollback plan: revert to previous version if issues arise

### Monitoring

- Track form completion rates
- Monitor validation error frequencies
- Measure time-to-completion improvements
- Collect user feedback on new flow

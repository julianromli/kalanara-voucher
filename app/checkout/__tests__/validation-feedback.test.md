# Checkout Form Validation Feedback Tests

## Test Coverage for Task 9: Enhance Form Validation Feedback

### Requirement 5.1: Specific error messages for missing required fields

**Test Case 1.1: Missing customer name**
- Action: Submit form without filling "Full Name" field
- Expected: Error message "Nama lengkap wajib diisi" appears below the field
- Status: ✅ Implemented

**Test Case 1.2: Missing customer email**
- Action: Submit form without filling "Email" field
- Expected: Error message "Email wajib diisi" appears below the field
- Status: ✅ Implemented

**Test Case 1.3: Missing customer phone**
- Action: Submit form without filling "WhatsApp" field in Your Details
- Expected: Error message "Nomor WhatsApp wajib diisi" appears below the field
- Status: ✅ Implemented

**Test Case 1.4: Missing recipient name**
- Action: Submit form without filling "Recipient Name" field
- Expected: Error message "Nama penerima wajib diisi" appears below the field
- Status: ✅ Implemented

**Test Case 1.5: Missing recipient phone**
- Action: Submit form without filling "Recipient WhatsApp" field
- Expected: Error message "Nomor WhatsApp wajib diisi" appears below the field
- Status: ✅ Implemented

**Test Case 1.6: Missing recipient email (when required)**
- Action: Select Email or Both delivery method, then submit without filling recipient email
- Expected: Error message "Email wajib diisi untuk pengiriman email" appears below the field
- Status: ✅ Implemented

### Requirement 5.2: Email format validation message

**Test Case 2.1: Invalid customer email format**
- Action: Enter "invalidemail" in customer email field and blur
- Expected: Error message "Format email tidak valid (contoh: nama@email.com)" appears
- Status: ✅ Implemented

**Test Case 2.2: Invalid recipient email format**
- Action: Select Email delivery, enter "invalidemail" in recipient email field and blur
- Expected: Error message "Format email tidak valid (contoh: nama@email.com)" appears
- Status: ✅ Implemented

### Requirement 5.3: WhatsApp format validation message with examples

**Test Case 3.1: Invalid customer phone format**
- Action: Enter "123" in customer WhatsApp field and blur
- Expected: Error message "Gunakan format 08xxxxxxxx atau +62xxxxxxxx" appears
- Status: ✅ Implemented

**Test Case 3.2: Invalid recipient phone format**
- Action: Enter "123" in recipient WhatsApp field and blur
- Expected: Error message "Gunakan format 08xxxxxxxx atau +62xxxxxxxx" appears
- Status: ✅ Implemented

**Test Case 3.3: Format hint displayed**
- Action: View customer WhatsApp field
- Expected: Format hint "Format: 08xx xxxx xxxx atau +62 xxx xxxx xxxx" appears below field
- Status: ✅ Implemented

### Requirement 5.4: Error messages clear immediately when corrected

**Test Case 4.1: Email error clears on valid input**
- Action: Enter invalid email, see error, then enter valid email
- Expected: Error message disappears immediately as user types valid email
- Status: ✅ Implemented (onChange handler clears errors when pattern matches)

**Test Case 4.2: Phone error clears on valid input**
- Action: Enter invalid phone, see error, then enter valid phone
- Expected: Error message disappears immediately as user types valid phone
- Status: ✅ Implemented (onChange handler clears errors when pattern matches)

**Test Case 4.3: Required field error clears on input**
- Action: Try to submit with empty field, see error, then enter value
- Expected: Error message disappears when field receives valid input
- Status: ✅ Implemented (onChange handler clears errors)

### Requirement 5.5: Form submission prevented and focus on first error field

**Test Case 5.1: Submission prevented with errors**
- Action: Submit form with multiple validation errors
- Expected: Form does not submit, processing does not start
- Status: ✅ Implemented (onSubmit checks for errors and returns early)

**Test Case 5.2: Focus on first error field**
- Action: Submit form with multiple validation errors
- Expected: Focus moves to the first field with an error
- Status: ✅ Implemented (setFocus called with first error field)

**Test Case 5.3: Error field styling**
- Action: Submit form with validation errors
- Expected: Error fields have red border (border-destructive) and red focus ring
- Status: ✅ Implemented (className conditionally applies border-destructive and focus-visible:ring-destructive/40)

## Accessibility Features

**Test Case A.1: ARIA labels for error states**
- Expected: All error fields have aria-invalid="true"
- Status: ✅ Implemented

**Test Case A.2: Error message association**
- Expected: All error messages have aria-describedby linking to error message ID
- Status: ✅ Implemented

**Test Case A.3: Screen reader announcements**
- Expected: Screen readers announce error messages when they appear
- Status: ✅ Implemented (error messages have unique IDs and aria-describedby)

## Implementation Details

### Code Changes Made:

1. **Added setFocus hook** to useForm destructuring for focus management
2. **Enhanced onSubmit handler** with error checking and focus management
3. **Updated all required field validations** with specific Indonesian error messages
4. **Added onChange handlers** to all fields for immediate error clearing
5. **Added aria-invalid and aria-describedby** attributes for accessibility
6. **Added error message display** below each field with red styling
7. **Added format hints** for email and phone fields

### Validation Rules:

- **customerName**: Required, message: "Nama lengkap wajib diisi"
- **customerEmail**: Required + email pattern, messages: "Email wajib diisi" / "Format email tidak valid (contoh: nama@email.com)"
- **customerPhone**: Required + phone pattern, messages: "Nomor WhatsApp wajib diisi" / "Gunakan format 08xxxxxxxx atau +62xxxxxxxx"
- **recipientName**: Required, message: "Nama penerima wajib diisi"
- **recipientPhone**: Required + phone pattern, messages: "Nomor WhatsApp wajib diisi" / "Gunakan format 08xxxxxxxx atau +62xxxxxxxx"
- **recipientEmail**: Conditionally required + email pattern, messages: "Email wajib diisi untuk pengiriman email" / "Format email tidak valid (contoh: nama@email.com)"

### Error Clearing Logic:

- Email fields: Clear error when value matches `/^\S+@\S+$/i`
- Phone fields: Clear error when value matches `/^(\+62|62|0)[\d\s-]{8,14}$/`
- All fields: Clear error on onChange when pattern matches

## Manual Testing Checklist

- [ ] Submit form with all fields empty - see all error messages
- [ ] Enter invalid email - see format error message
- [ ] Enter invalid phone - see format error message with examples
- [ ] Correct invalid email - error clears immediately
- [ ] Correct invalid phone - error clears immediately
- [ ] Submit with errors - focus moves to first error field
- [ ] Error fields have red borders and red focus rings
- [ ] Format hints visible for phone fields
- [ ] Test with screen reader (NVDA/JAWS) - error messages announced
- [ ] Test keyboard navigation - can tab through error fields
- [ ] Test on mobile - error messages visible and readable

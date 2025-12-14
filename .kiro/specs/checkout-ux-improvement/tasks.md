# Implementation Plan

- [x] 1. Update form interface and default values




  - Modify CheckoutForm interface to make recipientEmail optional
  - Change default deliveryMethod from EMAIL to WHATSAPP
  - Update form defaultValues in useForm hook
  - _Requirements: 3.2_

- [x] 2. Remove email field from Recipient Details section





  - Remove recipientEmail Input component from Recipient Details section
  - Remove recipientEmail validation from register() in that section
  - Update section layout to accommodate removed field


  - _Requirements: 1.1, 1.2_


- [x] 3. Implement conditional email field logic




  - Add computed variable showRecipientEmail based on sendTo and deliveryMethod

  - Create conditional rendering logic for email field
  - Implement email field in Voucher Delivery Options section
  - _Requirements: 2.2, 2.3, 4.2, 4.3_

- [x] 4. Implement conditional email validation


  - Add conditional validation rules for recipientEmail based on showRecipientEmail


  - Update validation messages in Indonesian

  - Ensure validation triggers on field visibility changes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_



- [-]* 4.1 Write property test for email validation and visibility coupling

  - **Property 2: Email validation and visibility coupling**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 5. Reorder delivery method options


  - Update delivery method array to place WhatsApp first
  - Update UI rendering order: WhatsApp, Email, Both



  - Add visual emphasis for WhatsApp option (primary styling)
  - _Requirements: 3.1, 3.4_

- [x] 6. Update form submission logic


  - Implement email value resolution logic (customer vs recipient email)
  - Update targetEmail determination based on sendTo selection
  - Ensure email delivery only triggers when email is available



  - _Requirements: 4.1_

- [ ]* 6.1 Write property test for email value resolution
  - **Property 3: Email value resolution**
  - **Validates: Requirements 4.1**

- [x] 7. Implement dynamic field visibility updates


  - Ensure email field shows/hides smoothly when delivery method changes

  - Ensure email field shows/hides when sendTo toggle changes
  - Add CSS transitions for smooth appearance/disappearance
  - _Requirements: 2.4, 2.5, 4.4_

- [ ]* 7.1 Write property test for delivery option state transitions
  - **Property 9: Delivery option state transitions**
  - **Validates: Requirements 2.4, 2.5, 4.4**

- [x] 8. Update validation error handling


  - Ensure validation errors clear when field becomes optional
  - Ensure validation errors appear when field becomes required
  - Implement immediate error clearing on valid input
  - _Requirements: 5.4_

- [ ]* 8.1 Write property test for validation error clearing
  - **Property 7: Validation error clearing**
  - **Validates: Requirements 5.4**

- [x] 9. Enhance form validation feedback




  - Update error messages for missing required fields
  - Add format hints for email and WhatsApp fields
  - Implement focus management for first error field on submit
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ]* 9.1 Write property test for format validation consistency
  - **Property 6: Format validation consistency**
  - **Validates: Requirements 5.2, 5.3**

- [ ]* 9.2 Write property test for validation error handling on submission
  - **Property 8: Validation error handling on submission**
  - **Validates: Requirements 5.1, 5.5**


- [x] 10. Add accessibility improvements



  - Add ARIA labels for conditional email field
  - Implement screen reader announcements for field visibility changes
  - Ensure keyboard navigation works with dynamic fields
  - Test with screen reader (NVDA/JAWS)
  - _Requirements: All (accessibility support)_


- [x] 11. Implement responsive design updates



  - Ensure conditional email field works on mobile layouts
  - Test touch interactions for delivery method selection
  - Verify form layout on various screen sizes
  - _Requirements: All (responsive support)_

- [ ]* 12. Write property test for form section data persistence
  - **Property 4: Form section data persistence**
  - **Validates: Requirements 1.4**

- [ ]* 13. Write property test for recipient details validation
  - **Property 5: Recipient details validation without email**
  - **Validates: Requirements 1.3**

- [ ]* 14. Write unit tests for edge cases
  - Test initial page load with WhatsApp default
  - Test delivery method ordering in DOM
  - Test email field visibility in Recipient Details section
  - Test email field presence in Delivery Options section
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.4_


- [-] 15. Manual testing and polish



  - Test complete checkout flow with WhatsApp-only delivery
  - Test complete checkout flow with Email delivery
  - Test complete checkout flow with Both delivery methods
  - Test Send to Me vs Direct to Recipient scenarios
  - Verify smooth animations and transitions
  - Test on multiple browsers (Chrome, Firefox, Safari, Edge)
  - Test on mobile devices (iOS Safari, Android Chrome)
  - _Requirements: All_

- [-] 16. Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.

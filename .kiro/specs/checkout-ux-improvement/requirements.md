# Requirements Document

## Introduction

This feature improves the checkout page UX by streamlining the form flow to better match the target audience's preferences (Indonesian mothers who primarily use WhatsApp). The improvement removes email from the recipient details section and makes it conditional based on the selected delivery method, reducing friction in the checkout process.

## Glossary

- **Checkout Form**: The multi-section form on the checkout page where customers enter purchase and delivery information
- **Recipient Details Section**: Form section collecting information about the voucher recipient (name, contact details, message)
- **Voucher Delivery Options Section**: Form section where customers choose how and to whom the voucher should be delivered
- **Delivery Method**: The channel through which the voucher is sent (WhatsApp, Email, or Both)
- **Primary Delivery Method**: WhatsApp, as it is the preferred communication channel for the target audience
- **Conditional Field**: A form field that appears or becomes required based on other form selections

## Requirements

### Requirement 1

**User Story:** As a customer purchasing a voucher, I want a streamlined checkout form that only asks for necessary information, so that I can complete my purchase quickly without unnecessary fields.

#### Acceptance Criteria

1. WHEN a customer views the Recipient Details section THEN the system SHALL display fields for recipient name, WhatsApp number, and optional message only
2. WHEN a customer views the Recipient Details section THEN the system SHALL NOT display an email field
3. WHEN a customer completes the Recipient Details section with only name and WhatsApp THEN the system SHALL accept the form as valid for that section
4. WHEN a customer navigates between form sections THEN the system SHALL maintain all previously entered data

### Requirement 2

**User Story:** As a customer who wants email delivery, I want to provide email addresses only when I select email as a delivery method, so that I don't have to fill unnecessary fields.

#### Acceptance Criteria

1. WHEN a customer selects WhatsApp as the delivery method THEN the system SHALL NOT require any email addresses
2. WHEN a customer selects Email as the delivery method THEN the system SHALL display and require the recipient email field in the Voucher Delivery Options section
3. WHEN a customer selects Both (Email & WhatsApp) as the delivery method THEN the system SHALL display and require the recipient email field in the Voucher Delivery Options section
4. WHEN a customer changes from Email/Both to WhatsApp-only THEN the system SHALL remove email validation requirements and hide the email field
5. WHEN a customer changes from WhatsApp-only to Email/Both THEN the system SHALL display the email field and apply validation requirements

### Requirement 3

**User Story:** As a customer, I want WhatsApp to be the default and most prominent delivery option, so that I can quickly select my preferred delivery method.

#### Acceptance Criteria

1. WHEN a customer views the Voucher Delivery Options section THEN the system SHALL display WhatsApp as the first delivery method option
2. WHEN a customer first loads the checkout page THEN the system SHALL pre-select WhatsApp as the default delivery method
3. WHEN WhatsApp is selected as the delivery method THEN the system SHALL visually emphasize it as the primary option
4. WHEN a customer views delivery method options THEN the system SHALL display them in this order: WhatsApp, Email, Both

### Requirement 4

**User Story:** As a customer using the "Send to Me" option, I want my email to be used automatically when I select email delivery, so that I don't have to enter it twice.

#### Acceptance Criteria

1. WHEN a customer selects "Send to Me" in the send-to toggle THEN the system SHALL use the customer's email from "Your Details" section for email delivery
2. WHEN a customer selects "Send to Me" and Email/Both delivery method THEN the system SHALL NOT display a separate recipient email field
3. WHEN a customer selects "Direct to Recipient" and Email/Both delivery method THEN the system SHALL display the recipient email field in the Voucher Delivery Options section
4. WHEN the send-to selection changes THEN the system SHALL update email field visibility and validation accordingly

### Requirement 5

**User Story:** As a customer, I want clear validation messages that guide me to complete the form correctly, so that I understand what information is needed.

#### Acceptance Criteria

1. WHEN a customer submits the form with missing required fields THEN the system SHALL display specific error messages for each missing field
2. WHEN a customer enters an invalid email format THEN the system SHALL display a validation message indicating the correct format
3. WHEN a customer enters an invalid WhatsApp number format THEN the system SHALL display a validation message with example formats
4. WHEN a customer corrects a validation error THEN the system SHALL remove the error message immediately
5. WHEN validation errors exist THEN the system SHALL prevent form submission and focus on the first error field

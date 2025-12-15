/**
 * Create Transaction API Property Tests
 * 
 * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
 * **Validates: Requirements 2.2**
 * 
 * Tests that transaction request payloads contain all required fields
 */

import { describe, test, expect } from "vitest";
import fc from "fast-check";
import type {
  MidtransTransactionRequest,
  MidtransCustomerDetails,
  MidtransTransactionDetails,
} from "@/lib/midtrans/types";

// ============================================================================
// Helper Functions (extracted from route for testing)
// ============================================================================

/**
 * Split customer name into first and last name
 */
function splitName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Build transaction request from checkout data
 */
function buildTransactionRequest(
  orderId: string,
  grossAmount: number,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  serviceId: string,
  serviceName: string,
  servicePrice: number,
  finishUrl: string
): MidtransTransactionRequest {
  const { firstName, lastName } = splitName(customerName);

  return {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    customer_details: {
      first_name: firstName,
      last_name: lastName,
      email: customerEmail,
      phone: customerPhone,
    },
    item_details: [
      {
        id: serviceId,
        name: serviceName,
        price: servicePrice,
        quantity: 1,
      },
    ],
    callbacks: {
      finish: finishUrl,
    },
  };
}

/**
 * Validate that a transaction request has all required fields
 */
function isValidTransactionRequest(request: MidtransTransactionRequest): boolean {
  // Check transaction_details
  if (!request.transaction_details) return false;
  if (!request.transaction_details.order_id) return false;
  if (typeof request.transaction_details.gross_amount !== "number") return false;
  if (request.transaction_details.gross_amount <= 0) return false;

  // Check customer_details
  if (!request.customer_details) return false;
  if (!request.customer_details.first_name) return false;
  if (!request.customer_details.email) return false;
  if (!request.customer_details.phone) return false;

  return true;
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

// Generate valid order IDs (KSP-{timestamp}-{random})
const orderIdArb = fc.tuple(
  fc.integer({ min: 1000000000000, max: 9999999999999 }),
  fc.string({ minLength: 6, maxLength: 6 }).map(s => s.replace(/[^A-Z0-9]/gi, 'X').toUpperCase())
).map(([timestamp, random]) => `KSP-${timestamp}-${random}`);

// Generate valid amounts (positive integers, typical IDR range)
const amountArb = fc.integer({ min: 10000, max: 100000000 });

// Generate valid names (non-empty, may have multiple parts)
const nameArb = fc.array(
  fc.string({ minLength: 2, maxLength: 15 }).map(s => s.replace(/[^a-zA-Z]/g, 'a')),
  { minLength: 1, maxLength: 3 }
).map(parts => parts.join(' ')).filter(s => s.trim().length >= 2);

// Generate valid emails
const emailArb = fc.tuple(
  fc.string({ minLength: 3, maxLength: 15 }).map(s => s.replace(/[^a-z0-9]/gi, 'a').toLowerCase()),
  fc.constantFrom("gmail.com", "yahoo.com", "email.com", "test.com")
).map(([local, domain]) => `${local}@${domain}`);

// Generate valid phone numbers (Indonesian format)
const phoneArb = fc.tuple(
  fc.constantFrom("08", "+628"),
  fc.string({ minLength: 9, maxLength: 12 }).map(s => s.replace(/[^0-9]/g, '1'))
).map(([prefix, number]) => `${prefix}${number}`);

// Generate valid service IDs (UUID-like)
const serviceIdArb = fc.uuid();

// Generate valid service names
const serviceNameArb = fc.string({ minLength: 3, maxLength: 50 })
  .map(s => s.replace(/[^a-zA-Z ]/g, 'a'))
  .filter(s => s.trim().length >= 3);

// Generate valid URLs
const urlArb = fc.tuple(
  fc.constantFrom("http://localhost:3000", "https://example.com", "https://kalanara.com"),
  fc.constantFrom("/checkout/success", "/payment/complete")
).map(([base, path]) => `${base}${path}`);

// ============================================================================
// Property Tests
// ============================================================================

describe("Transaction Request Completeness", () => {
  /**
   * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
   * **Validates: Requirements 2.2**
   * 
   * For any valid checkout data, the Midtrans transaction request SHALL contain
   * order_id, gross_amount, and customer_details fields.
   */
  test("Property 6: Transaction request contains required fields for any valid input", () => {
    fc.assert(
      fc.property(
        orderIdArb,
        amountArb,
        nameArb,
        emailArb,
        phoneArb,
        serviceIdArb,
        serviceNameArb,
        amountArb,
        urlArb,
        (orderId, grossAmount, customerName, customerEmail, customerPhone, serviceId, serviceName, servicePrice, finishUrl) => {
          const request = buildTransactionRequest(
            orderId,
            grossAmount,
            customerName,
            customerEmail,
            customerPhone,
            serviceId,
            serviceName,
            servicePrice,
            finishUrl
          );

          // Verify required fields exist
          expect(request.transaction_details).toBeDefined();
          expect(request.transaction_details.order_id).toBe(orderId);
          expect(request.transaction_details.gross_amount).toBe(grossAmount);
          
          expect(request.customer_details).toBeDefined();
          expect(request.customer_details.first_name).toBeDefined();
          expect(request.customer_details.first_name.length).toBeGreaterThan(0);
          expect(request.customer_details.email).toBe(customerEmail);
          expect(request.customer_details.phone).toBe(customerPhone);

          // Verify the request passes validation
          expect(isValidTransactionRequest(request)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6: Name splitting preserves all name parts", () => {
    fc.assert(
      fc.property(
        nameArb,
        (fullName) => {
          const { firstName, lastName } = splitName(fullName);
          
          // First name should always exist
          expect(firstName).toBeDefined();
          expect(firstName.length).toBeGreaterThan(0);
          
          // If original name had multiple parts, lastName should exist
          const parts = fullName.trim().split(/\s+/);
          if (parts.length > 1) {
            expect(lastName).toBeDefined();
          }
          
          // Reconstructed name should match original (minus extra spaces)
          const reconstructed = lastName ? `${firstName} ${lastName}` : firstName;
          expect(reconstructed).toBe(fullName.trim().replace(/\s+/g, ' '));
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6: Transaction request has valid item details", () => {
    fc.assert(
      fc.property(
        orderIdArb,
        amountArb,
        nameArb,
        emailArb,
        phoneArb,
        serviceIdArb,
        serviceNameArb,
        amountArb,
        urlArb,
        (orderId, grossAmount, customerName, customerEmail, customerPhone, serviceId, serviceName, servicePrice, finishUrl) => {
          const request = buildTransactionRequest(
            orderId,
            grossAmount,
            customerName,
            customerEmail,
            customerPhone,
            serviceId,
            serviceName,
            servicePrice,
            finishUrl
          );

          // Verify item details
          expect(request.item_details).toBeDefined();
          expect(request.item_details).toHaveLength(1);
          expect(request.item_details![0].id).toBe(serviceId);
          expect(request.item_details![0].name).toBe(serviceName);
          expect(request.item_details![0].price).toBe(servicePrice);
          expect(request.item_details![0].quantity).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6: Transaction request has valid callback URL", () => {
    fc.assert(
      fc.property(
        orderIdArb,
        amountArb,
        nameArb,
        emailArb,
        phoneArb,
        serviceIdArb,
        serviceNameArb,
        amountArb,
        urlArb,
        (orderId, grossAmount, customerName, customerEmail, customerPhone, serviceId, serviceName, servicePrice, finishUrl) => {
          const request = buildTransactionRequest(
            orderId,
            grossAmount,
            customerName,
            customerEmail,
            customerPhone,
            serviceId,
            serviceName,
            servicePrice,
            finishUrl
          );

          // Verify callbacks
          expect(request.callbacks).toBeDefined();
          expect(request.callbacks!.finish).toBe(finishUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Unit Tests for Edge Cases
// ============================================================================

describe("Transaction Request Edge Cases", () => {
  test("handles single-word names correctly", () => {
    const { firstName, lastName } = splitName("Madonna");
    expect(firstName).toBe("Madonna");
    expect(lastName).toBeUndefined();
  });

  test("handles multi-word names correctly", () => {
    const { firstName, lastName } = splitName("John Doe Smith");
    expect(firstName).toBe("John");
    expect(lastName).toBe("Doe Smith");
  });

  test("handles names with extra spaces", () => {
    const { firstName, lastName } = splitName("  John   Doe  ");
    expect(firstName).toBe("John");
    expect(lastName).toBe("Doe");
  });

  test("validates transaction request with missing order_id", () => {
    const invalidRequest: MidtransTransactionRequest = {
      transaction_details: {
        order_id: "",
        gross_amount: 100000,
      },
      customer_details: {
        first_name: "John",
        email: "john@test.com",
        phone: "08123456789",
      },
    };
    expect(isValidTransactionRequest(invalidRequest)).toBe(false);
  });

  test("validates transaction request with zero amount", () => {
    const invalidRequest: MidtransTransactionRequest = {
      transaction_details: {
        order_id: "KSP-123-ABC",
        gross_amount: 0,
      },
      customer_details: {
        first_name: "John",
        email: "john@test.com",
        phone: "08123456789",
      },
    };
    expect(isValidTransactionRequest(invalidRequest)).toBe(false);
  });

  test("validates transaction request with negative amount", () => {
    const invalidRequest: MidtransTransactionRequest = {
      transaction_details: {
        order_id: "KSP-123-ABC",
        gross_amount: -100000,
      },
      customer_details: {
        first_name: "John",
        email: "john@test.com",
        phone: "08123456789",
      },
    };
    expect(isValidTransactionRequest(invalidRequest)).toBe(false);
  });

  test("validates complete transaction request", () => {
    const validRequest: MidtransTransactionRequest = {
      transaction_details: {
        order_id: "KSP-1234567890123-ABCDEF",
        gross_amount: 500000,
      },
      customer_details: {
        first_name: "John",
        last_name: "Doe",
        email: "john@test.com",
        phone: "08123456789",
      },
      item_details: [
        {
          id: "service-1",
          name: "Spa Treatment",
          price: 500000,
          quantity: 1,
        },
      ],
    };
    expect(isValidTransactionRequest(validRequest)).toBe(true);
  });
});

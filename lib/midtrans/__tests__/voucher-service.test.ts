/**
 * Property-Based Tests for Voucher Service
 * 
 * Tests the following correctness properties:
 * - Property 5: Voucher Creation Precondition
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import type { OrderWithService, PaymentStatus } from "@/lib/database.types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock OrderWithService for testing
 */
function createMockOrder(
  paymentStatus: PaymentStatus,
  hasVoucherId: boolean = false
): OrderWithService {
  return {
    id: `order-${Date.now()}`,
    voucher_id: hasVoucherId ? `voucher-${Date.now()}` : null,
    customer_email: "customer@test.com",
    customer_name: "Test Customer",
    customer_phone: "+6281234567890",
    payment_method: "BANK_TRANSFER",
    payment_status: paymentStatus,
    total_amount: 500000,
    created_at: new Date().toISOString(),
    midtrans_order_id: `KSP-${Date.now()}-TEST`,
    midtrans_transaction_id: "TXN-123",
    midtrans_payment_type: "bank_transfer",
    midtrans_transaction_time: new Date().toISOString(),
    service_id: "service-123",
    recipient_name: "Test Recipient",
    recipient_email: "recipient@test.com",
    recipient_phone: "+6281234567891",
    sender_message: "Happy Birthday!",
    delivery_method: "EMAIL",
    send_to: "RECIPIENT",
    services: {
      id: "service-123",
      name: "Relaxing Massage",
      description: "A relaxing full body massage",
      duration: 60,
      price: 500000,
      category: "MASSAGE",
      image_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Property 5: Voucher Creation Precondition
// **Feature: midtrans-payment-integration, Property 5: Voucher Creation Precondition**
// **Validates: Requirements 8.2, 8.3**
// ============================================================================

describe("Property 5: Voucher Creation Precondition", () => {
  /**
   * Property: Vouchers should only be created for COMPLETED orders
   * 
   * This test verifies the precondition logic that determines whether
   * a voucher should be created based on payment status.
   */

  /**
   * Helper function to check if voucher creation should proceed
   * This mirrors the logic in the webhook handler
   */
  function shouldCreateVoucher(order: OrderWithService): boolean {
    // Only create voucher for COMPLETED orders
    if (order.payment_status !== "COMPLETED") {
      return false;
    }
    
    // Don't create if voucher already exists (idempotency)
    if (order.voucher_id) {
      return false;
    }
    
    // Must have required fields
    if (!order.service_id || !order.recipient_name) {
      return false;
    }
    
    // Must have at least one contact method
    if (!order.recipient_email && !order.recipient_phone) {
      return false;
    }
    
    return true;
  }

  /**
   * Property: COMPLETED orders with valid data should allow voucher creation
   */
  it("should allow voucher creation only for COMPLETED orders", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("COMPLETED", "PENDING", "FAILED", "REFUNDED"),
        (status) => {
          const order = createMockOrder(status);
          const shouldCreate = shouldCreateVoucher(order);
          
          // Only COMPLETED orders should allow voucher creation
          if (status === "COMPLETED") {
            return shouldCreate === true;
          } else {
            return shouldCreate === false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-COMPLETED orders should never allow voucher creation
   */
  it("should never create vouchers for non-COMPLETED orders", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("PENDING", "FAILED", "REFUNDED"),
        (status) => {
          const order = createMockOrder(status);
          return shouldCreateVoucher(order) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Orders with existing voucher_id should not create new voucher (idempotency)
   */
  it("should not create voucher if voucher_id already exists", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("COMPLETED", "PENDING", "FAILED", "REFUNDED"),
        (status) => {
          const order = createMockOrder(status, true); // hasVoucherId = true
          return shouldCreateVoucher(order) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: COMPLETED orders without required fields should not create voucher
   */
  it("should not create voucher if required fields are missing", () => {
    // Missing service_id
    const orderNoService = createMockOrder("COMPLETED");
    orderNoService.service_id = null;
    expect(shouldCreateVoucher(orderNoService)).toBe(false);

    // Missing recipient_name
    const orderNoRecipient = createMockOrder("COMPLETED");
    orderNoRecipient.recipient_name = null;
    expect(shouldCreateVoucher(orderNoRecipient)).toBe(false);

    // Missing both contact methods
    const orderNoContact = createMockOrder("COMPLETED");
    orderNoContact.recipient_email = null;
    orderNoContact.recipient_phone = null;
    expect(shouldCreateVoucher(orderNoContact)).toBe(false);
  });

  /**
   * Property: COMPLETED orders with at least one contact method should allow voucher creation
   */
  it("should allow voucher creation with either email or phone", () => {
    // Only email
    const orderEmailOnly = createMockOrder("COMPLETED");
    orderEmailOnly.recipient_phone = null;
    expect(shouldCreateVoucher(orderEmailOnly)).toBe(true);

    // Only phone
    const orderPhoneOnly = createMockOrder("COMPLETED");
    orderPhoneOnly.recipient_email = null;
    expect(shouldCreateVoucher(orderPhoneOnly)).toBe(true);

    // Both
    const orderBoth = createMockOrder("COMPLETED");
    expect(shouldCreateVoucher(orderBoth)).toBe(true);
  });

  /**
   * Property: The precondition check is deterministic
   */
  it("should produce deterministic results for same input", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PaymentStatus>("COMPLETED", "PENDING", "FAILED", "REFUNDED"),
        fc.boolean(), // hasVoucherId
        (status, hasVoucherId) => {
          const order = createMockOrder(status, hasVoucherId);
          
          // Call multiple times
          const result1 = shouldCreateVoucher(order);
          const result2 = shouldCreateVoucher(order);
          const result3 = shouldCreateVoucher(order);
          
          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });
});

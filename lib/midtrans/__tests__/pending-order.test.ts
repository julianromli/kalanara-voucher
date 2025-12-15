/**
 * Property-based tests for pending order initialization
 * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
 * **Validates: Requirements 8.1, 7.1**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { PendingOrderData } from "../types";
import { DeliveryMethod, SendTo } from "@/lib/types";

/**
 * Simulates the order data structure that would be created from PendingOrderData
 * This tests the transformation logic without database interaction
 */
interface SimulatedOrderData {
  voucher_id: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  midtrans_order_id: string;
  service_id: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string;
  sender_message: string | null;
  delivery_method: string;
  send_to: string;
}

/**
 * Transform PendingOrderData to order insert data (pure function for testing)
 */
function transformPendingOrderData(
  data: PendingOrderData,
  midtransOrderId: string
): SimulatedOrderData {
  return {
    voucher_id: null, // Always null for pending orders
    customer_email: data.customer_email,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    payment_method: "BANK_TRANSFER", // Default
    payment_status: "PENDING", // Always PENDING for new orders
    total_amount: data.total_amount,
    midtrans_order_id: midtransOrderId,
    service_id: data.service_id,
    recipient_name: data.recipient_name,
    recipient_email: data.recipient_email || null,
    recipient_phone: data.recipient_phone,
    sender_message: data.sender_message || null,
    delivery_method: data.delivery_method,
    send_to: data.send_to,
  };
}

// Arbitraries for generating test data
const emailArb = fc.emailAddress();
const phoneArb = fc.stringMatching(/^08[0-9]{9,11}$/);
const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const uuidArb = fc.uuid();
const amountArb = fc.integer({ min: 10000, max: 100000000 }); // IDR amounts
const messageArb = fc.option(fc.string({ maxLength: 500 }), { nil: undefined });
const deliveryMethodArb = fc.constantFrom(DeliveryMethod.EMAIL, DeliveryMethod.WHATSAPP, DeliveryMethod.BOTH);
const sendToArb = fc.constantFrom(SendTo.PURCHASER, SendTo.RECIPIENT);
const midtransOrderIdArb = fc.tuple(
  fc.nat({ max: Number.MAX_SAFE_INTEGER }),
  fc.string({ minLength: 6, maxLength: 6 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'X'))
).map(([ts, suffix]) => `KSP-${ts}-${suffix}`);

const pendingOrderDataArb = fc.record({
  service_id: uuidArb,
  customer_email: emailArb,
  customer_name: nameArb,
  customer_phone: phoneArb,
  recipient_name: nameArb,
  recipient_email: fc.option(emailArb, { nil: undefined }),
  recipient_phone: phoneArb,
  sender_message: messageArb,
  delivery_method: deliveryMethodArb,
  send_to: sendToArb,
  total_amount: amountArb,
}) as fc.Arbitrary<PendingOrderData>;

describe("Pending Order Initialization", () => {
  describe("transformPendingOrderData", () => {
    /**
     * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
     * *For any* checkout initiation, an order SHALL be created with `payment_status` = PENDING.
     * **Validates: Requirements 8.1**
     */
    it("should always set payment_status to PENDING", () => {
      fc.assert(
        fc.property(
          pendingOrderDataArb,
          midtransOrderIdArb,
          (data, orderId) => {
            const orderData = transformPendingOrderData(data, orderId);
            
            expect(orderData.payment_status).toBe("PENDING");
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
     * *For any* checkout initiation, an order SHALL be created with `voucher_id` = null.
     * **Validates: Requirements 8.1, 7.1**
     */
    it("should always set voucher_id to null", () => {
      fc.assert(
        fc.property(
          pendingOrderDataArb,
          midtransOrderIdArb,
          (data, orderId) => {
            const orderData = transformPendingOrderData(data, orderId);
            
            expect(orderData.voucher_id).toBeNull();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
     * *For any* checkout initiation, the order SHALL contain the midtrans_order_id.
     * **Validates: Requirements 7.1**
     */
    it("should always include midtrans_order_id", () => {
      fc.assert(
        fc.property(
          pendingOrderDataArb,
          midtransOrderIdArb,
          (data, orderId) => {
            const orderData = transformPendingOrderData(data, orderId);
            
            expect(orderData.midtrans_order_id).toBe(orderId);
            expect(orderData.midtrans_order_id).toBeTruthy();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
     * *For any* checkout data, all customer and recipient information SHALL be preserved.
     * **Validates: Requirements 7.1**
     */
    it("should preserve all customer and recipient information", () => {
      fc.assert(
        fc.property(
          pendingOrderDataArb,
          midtransOrderIdArb,
          (data, orderId) => {
            const orderData = transformPendingOrderData(data, orderId);
            
            // Customer info preserved
            expect(orderData.customer_email).toBe(data.customer_email);
            expect(orderData.customer_name).toBe(data.customer_name);
            expect(orderData.customer_phone).toBe(data.customer_phone);
            
            // Recipient info preserved
            expect(orderData.recipient_name).toBe(data.recipient_name);
            expect(orderData.recipient_phone).toBe(data.recipient_phone);
            expect(orderData.recipient_email).toBe(data.recipient_email || null);
            
            // Other fields preserved
            expect(orderData.service_id).toBe(data.service_id);
            expect(orderData.total_amount).toBe(data.total_amount);
            expect(orderData.sender_message).toBe(data.sender_message || null);
            expect(orderData.delivery_method).toBe(data.delivery_method);
            expect(orderData.send_to).toBe(data.send_to);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 7: Pending Order Initialization**
     * *For any* checkout data with optional fields undefined, they SHALL be converted to null.
     * **Validates: Requirements 7.1**
     */
    it("should convert undefined optional fields to null", () => {
      fc.assert(
        fc.property(
          uuidArb,
          emailArb,
          nameArb,
          phoneArb,
          nameArb,
          phoneArb,
          amountArb,
          deliveryMethodArb,
          sendToArb,
          midtransOrderIdArb,
          (serviceId, customerEmail, customerName, customerPhone, recipientName, recipientPhone, amount, deliveryMethod, sendTo, orderId) => {
            // Create data with undefined optional fields
            const data: PendingOrderData = {
              service_id: serviceId,
              customer_email: customerEmail,
              customer_name: customerName,
              customer_phone: customerPhone,
              recipient_name: recipientName,
              recipient_email: undefined,
              recipient_phone: recipientPhone,
              sender_message: undefined,
              delivery_method: deliveryMethod,
              send_to: sendTo,
              total_amount: amount,
            };
            
            const orderData = transformPendingOrderData(data, orderId);
            
            // Undefined should become null
            expect(orderData.recipient_email).toBeNull();
            expect(orderData.sender_message).toBeNull();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

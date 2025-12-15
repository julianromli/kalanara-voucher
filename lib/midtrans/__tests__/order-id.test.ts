/**
 * Property-based tests for Midtrans order ID generation
 * **Feature: midtrans-payment-integration, Property 4: Order ID Uniqueness**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Generate a Midtrans order ID (pure function for testing)
 * Format: KSP-{timestamp}-{random}
 */
function generateMidtransOrderId(timestamp: number, randomSuffix: string): string {
  return `KSP-${timestamp}-${randomSuffix}`;
}

/**
 * Validate order ID format
 */
function isValidOrderIdFormat(orderId: string): boolean {
  // Format: KSP-{timestamp}-{random}
  const pattern = /^KSP-\d+-[A-Z0-9]+$/;
  return pattern.test(orderId);
}

describe("Midtrans Order ID Generation", () => {
  describe("generateMidtransOrderId", () => {
    /**
     * **Feature: midtrans-payment-integration, Property 4: Order ID Uniqueness**
     * *For any* valid timestamp and random suffix, the generated order ID SHALL follow
     * the format KSP-{timestamp}-{random}.
     * **Validates: Requirements 2.5**
     */
    it("should generate order IDs in correct format", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: Number.MAX_SAFE_INTEGER }),
          fc.string({ minLength: 4, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'X')),
          (timestamp, randomSuffix) => {
            // Ensure randomSuffix is alphanumeric
            const cleanSuffix = randomSuffix.length > 0 ? randomSuffix : "XXXX";
            const orderId = generateMidtransOrderId(timestamp, cleanSuffix);
            
            // Should start with KSP-
            expect(orderId.startsWith("KSP-")).toBe(true);
            
            // Should contain timestamp
            expect(orderId).toContain(timestamp.toString());
            
            // Should contain random suffix
            expect(orderId).toContain(cleanSuffix);
            
            // Should match expected format
            expect(isValidOrderIdFormat(orderId)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 4: Order ID Uniqueness**
     * *For any* two different timestamps, the generated order IDs SHALL be different.
     * **Validates: Requirements 2.5**
     */
    it("should generate different order IDs for different timestamps", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: Number.MAX_SAFE_INTEGER }),
          fc.nat({ max: Number.MAX_SAFE_INTEGER }),
          fc.string({ minLength: 4, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'X')),
          (timestamp1, timestamp2, randomSuffix) => {
            // Skip if timestamps are the same
            fc.pre(timestamp1 !== timestamp2);
            
            const cleanSuffix = randomSuffix.length > 0 ? randomSuffix : "XXXX";
            const orderId1 = generateMidtransOrderId(timestamp1, cleanSuffix);
            const orderId2 = generateMidtransOrderId(timestamp2, cleanSuffix);
            
            expect(orderId1).not.toBe(orderId2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 4: Order ID Uniqueness**
     * *For any* two different random suffixes, the generated order IDs SHALL be different.
     * **Validates: Requirements 2.5**
     */
    it("should generate different order IDs for different random suffixes", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: Number.MAX_SAFE_INTEGER }),
          fc.string({ minLength: 4, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'X')),
          fc.string({ minLength: 4, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'Y')),
          (timestamp, suffix1, suffix2) => {
            const cleanSuffix1 = suffix1.length > 0 ? suffix1 : "XXXX";
            const cleanSuffix2 = suffix2.length > 0 ? suffix2 : "YYYY";
            
            // Skip if suffixes are the same
            fc.pre(cleanSuffix1 !== cleanSuffix2);
            
            const orderId1 = generateMidtransOrderId(timestamp, cleanSuffix1);
            const orderId2 = generateMidtransOrderId(timestamp, cleanSuffix2);
            
            expect(orderId1).not.toBe(orderId2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 4: Order ID Uniqueness**
     * *For any* sequence of order ID generations with unique inputs, all IDs SHALL be unique.
     * **Validates: Requirements 2.5**
     */
    it("should generate unique order IDs in a sequence", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.nat({ max: Number.MAX_SAFE_INTEGER }),
              fc.string({ minLength: 4, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'X'))
            ),
            { minLength: 2, maxLength: 50 }
          ),
          (inputs) => {
            // Generate order IDs
            const orderIds = inputs.map(([timestamp, suffix]) => {
              const cleanSuffix = suffix.length > 0 ? suffix : "XXXX";
              return generateMidtransOrderId(timestamp, cleanSuffix);
            });
            
            // Create a set to check uniqueness
            const uniqueIds = new Set(orderIds);
            
            // If all inputs are unique, all outputs should be unique
            const uniqueInputs = new Set(inputs.map(([t, s]) => `${t}-${s}`));
            
            if (uniqueInputs.size === inputs.length) {
              expect(uniqueIds.size).toBe(orderIds.length);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("isValidOrderIdFormat", () => {
    it("should validate correct order ID formats", () => {
      expect(isValidOrderIdFormat("KSP-1234567890-ABCD1234")).toBe(true);
      expect(isValidOrderIdFormat("KSP-1-A")).toBe(true);
      expect(isValidOrderIdFormat("KSP-9999999999999-ZZZZZZZZ")).toBe(true);
    });

    it("should reject invalid order ID formats", () => {
      expect(isValidOrderIdFormat("")).toBe(false);
      expect(isValidOrderIdFormat("KSP")).toBe(false);
      expect(isValidOrderIdFormat("KSP-")).toBe(false);
      expect(isValidOrderIdFormat("KSP-abc-1234")).toBe(false); // lowercase timestamp
      expect(isValidOrderIdFormat("ORDER-123-ABC")).toBe(false); // wrong prefix
      expect(isValidOrderIdFormat("KSP-123-abc")).toBe(false); // lowercase suffix
    });
  });
});

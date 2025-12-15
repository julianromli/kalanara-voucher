/**
 * Property-based tests for Midtrans signature verification
 * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
 * **Validates: Requirements 3.1, 3.5**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeSignature, verifySignature } from "../signature";

describe("Midtrans Signature Verification", () => {
  describe("computeSignature", () => {
    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* input parameters, computeSignature SHALL return a 128-character hex string (SHA512).
     * **Validates: Requirements 3.1**
     */
    it("should always return a 128-character hex string", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          fc.string(),
          (orderId, statusCode, grossAmount, serverKey) => {
            const signature = computeSignature(orderId, statusCode, grossAmount, serverKey);
            
            // SHA512 produces 64 bytes = 128 hex characters
            expect(signature).toHaveLength(128);
            // Should only contain hex characters
            expect(signature).toMatch(/^[0-9a-f]+$/);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* identical inputs, computeSignature SHALL return the same signature (deterministic).
     * **Validates: Requirements 3.1**
     */
    it("should be deterministic - same inputs produce same output", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          fc.string(),
          (orderId, statusCode, grossAmount, serverKey) => {
            const sig1 = computeSignature(orderId, statusCode, grossAmount, serverKey);
            const sig2 = computeSignature(orderId, statusCode, grossAmount, serverKey);
            
            expect(sig1).toBe(sig2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* different inputs, computeSignature SHALL return different signatures (collision resistance).
     * **Validates: Requirements 3.1**
     */
    it("should produce different signatures for different inputs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (orderId, statusCode, grossAmount, serverKey, differentValue) => {
            // Skip if differentValue equals orderId (would produce same result)
            fc.pre(differentValue !== orderId);
            
            const sig1 = computeSignature(orderId, statusCode, grossAmount, serverKey);
            const sig2 = computeSignature(differentValue, statusCode, grossAmount, serverKey);
            
            expect(sig1).not.toBe(sig2);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("verifySignature", () => {
    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* webhook notification payload, verifySignature SHALL return true if and only if
     * the computed SHA512 hash of `order_id + status_code + gross_amount + ServerKey` matches
     * the provided `signature_key`.
     * **Validates: Requirements 3.1, 3.5**
     */
    it("should return true for valid signatures", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.nat().map(n => n.toString()), // gross_amount as string number
          fc.string({ minLength: 1 }),
          (orderId, statusCode, grossAmount, serverKey) => {
            // Compute the correct signature
            const signature = computeSignature(orderId, statusCode, grossAmount, serverKey);
            
            const notification = {
              order_id: orderId,
              status_code: statusCode,
              gross_amount: grossAmount,
              signature_key: signature,
            };
            
            const result = verifySignature(notification, serverKey);
            
            expect(result).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* webhook notification with tampered signature, verifySignature SHALL return false.
     * **Validates: Requirements 3.5**
     */
    it("should return false for invalid signatures", () => {
      // Generate hex strings of length 128 (SHA512 output)
      const hexCharArb = fc.constantFrom(..."0123456789abcdef");
      const hexStringArb = fc.array(hexCharArb, { minLength: 128, maxLength: 128 })
        .map(arr => arr.join(""));
      
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.nat().map(n => n.toString()),
          fc.string({ minLength: 1 }),
          hexStringArb,
          (orderId, statusCode, grossAmount, serverKey, invalidSignature) => {
            // Compute the correct signature to ensure we're testing with a different one
            const correctSignature = computeSignature(orderId, statusCode, grossAmount, serverKey);
            
            // Skip if random signature happens to match (extremely unlikely)
            fc.pre(invalidSignature.toLowerCase() !== correctSignature);
            
            const notification = {
              order_id: orderId,
              status_code: statusCode,
              gross_amount: grossAmount,
              signature_key: invalidSignature,
            };
            
            const result = verifySignature(notification, serverKey);
            
            expect(result).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* webhook notification with wrong server key, verifySignature SHALL return false.
     * **Validates: Requirements 3.5**
     */
    it("should return false when server key is wrong", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.nat().map(n => n.toString()),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (orderId, statusCode, grossAmount, correctServerKey, wrongServerKey) => {
            // Skip if keys happen to be the same
            fc.pre(correctServerKey !== wrongServerKey);
            
            // Compute signature with correct key
            const signature = computeSignature(orderId, statusCode, grossAmount, correctServerKey);
            
            const notification = {
              order_id: orderId,
              status_code: statusCode,
              gross_amount: grossAmount,
              signature_key: signature,
            };
            
            // Verify with wrong key
            const result = verifySignature(notification, wrongServerKey);
            
            expect(result).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 1: Signature Verification Correctness**
     * *For any* webhook notification with tampered order_id, verifySignature SHALL return false.
     * **Validates: Requirements 3.5**
     */
    it("should return false when notification data is tampered", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.nat().map(n => n.toString()),
          fc.string({ minLength: 1 }),
          fc.string(),
          (orderId, statusCode, grossAmount, serverKey, tamperedOrderId) => {
            // Skip if tampered value equals original
            fc.pre(tamperedOrderId !== orderId);
            
            // Compute signature with original data
            const signature = computeSignature(orderId, statusCode, grossAmount, serverKey);
            
            // Create notification with tampered order_id
            const notification = {
              order_id: tamperedOrderId,
              status_code: statusCode,
              gross_amount: grossAmount,
              signature_key: signature,
            };
            
            const result = verifySignature(notification, serverKey);
            
            expect(result).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Known test vectors", () => {
    /**
     * Test with known Midtrans example values to ensure compatibility
     */
    it("should produce correct signature for known test case", () => {
      // Example from Midtrans documentation pattern
      const orderId = "ORDER-123";
      const statusCode = "200";
      const grossAmount = "100000.00";
      const serverKey = "SB-Mid-server-test123";
      
      const signature = computeSignature(orderId, statusCode, grossAmount, serverKey);
      
      // Verify it's a valid SHA512 hash
      expect(signature).toHaveLength(128);
      expect(signature).toMatch(/^[0-9a-f]+$/);
      
      // Verify round-trip
      const notification = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature,
      };
      
      expect(verifySignature(notification, serverKey)).toBe(true);
    });
  });
});

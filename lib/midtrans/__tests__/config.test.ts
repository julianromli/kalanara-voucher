/**
 * Property-based tests for Midtrans configuration
 * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
 * **Validates: Requirements 5.3, 5.4**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  getMidtransConfig,
  getClientMidtransConfig,
  validateMidtransConfig,
  MidtransConfigError,
} from "../config";

describe("Midtrans Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getMidtransConfig", () => {
    /**
     * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
     * *For any* valid environment configuration, getMidtransConfig SHALL return
     * a config object containing serverKey, clientKey, and environment-appropriate URLs.
     * **Validates: Requirements 5.3, 5.4**
     */
    it("should return complete config when all env vars are set", () => {
      // Use alphanumeric strings to avoid whitespace-only values
      const nonEmptyAlphanumeric = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          nonEmptyAlphanumeric,
          nonEmptyAlphanumeric,
          fc.boolean(),
          (serverKey, clientKey, isProduction) => {
            process.env.MIDTRANS_SERVER_KEY = serverKey;
            process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = clientKey;
            process.env.MIDTRANS_IS_PRODUCTION = isProduction ? "true" : "false";

            const config = getMidtransConfig();

            // Config must contain all required fields
            expect(config.serverKey).toBe(serverKey);
            expect(config.clientKey).toBe(clientKey);
            expect(config.isProduction).toBe(isProduction);
            expect(config.snapUrl).toBeDefined();
            expect(config.apiUrl).toBeDefined();

            // URLs must match environment
            if (isProduction) {
              expect(config.snapUrl).toContain("app.midtrans.com");
              expect(config.apiUrl).toContain("app.midtrans.com");
            } else {
              expect(config.snapUrl).toContain("sandbox");
              expect(config.apiUrl).toContain("sandbox");
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
     * *For any* missing server key, getMidtransConfig SHALL throw MidtransConfigError.
     * **Validates: Requirements 5.3**
     */
    it("should throw error when server key is missing", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (clientKey) => {
            delete process.env.MIDTRANS_SERVER_KEY;
            process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = clientKey;

            expect(() => getMidtransConfig()).toThrow(MidtransConfigError);
            expect(() => getMidtransConfig()).toThrow("MIDTRANS_SERVER_KEY");

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: midtrans-payment-integration, Property 6: Transaction Request Completeness**
     * *For any* missing client key, getMidtransConfig SHALL throw MidtransConfigError.
     * **Validates: Requirements 5.4**
     */
    it("should throw error when client key is missing", () => {
      // Use non-whitespace strings for server key
      const nonEmptyAlphanumeric = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          nonEmptyAlphanumeric,
          (serverKey) => {
            process.env.MIDTRANS_SERVER_KEY = serverKey;
            delete process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

            expect(() => getMidtransConfig()).toThrow(MidtransConfigError);
            expect(() => getMidtransConfig()).toThrow("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY");

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * *For any* empty string server key, getMidtransConfig SHALL throw MidtransConfigError.
     * **Validates: Requirements 5.3**
     */
    it("should throw error when server key is empty string", () => {
      process.env.MIDTRANS_SERVER_KEY = "";
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "test-client-key";

      expect(() => getMidtransConfig()).toThrow(MidtransConfigError);
    });

    /**
     * *For any* whitespace-only server key, getMidtransConfig SHALL throw MidtransConfigError.
     * **Validates: Requirements 5.3**
     */
    it("should throw error when server key is whitespace only", () => {
      // Generate whitespace strings of various lengths
      const whitespaceArb = fc.array(
        fc.constantFrom(" ", "\t", "\n"),
        { minLength: 1, maxLength: 10 }
      ).map(arr => arr.join(""));
      
      fc.assert(
        fc.property(
          whitespaceArb,
          (whitespace) => {
            process.env.MIDTRANS_SERVER_KEY = whitespace;
            process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "test-client-key";

            expect(() => getMidtransConfig()).toThrow(MidtransConfigError);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("getClientMidtransConfig", () => {
    /**
     * *For any* valid client key, getClientMidtransConfig SHALL return only client-safe config.
     */
    it("should return only client-safe configuration", () => {
      // Use non-whitespace strings to avoid validation failures
      const nonEmptyAlphanumeric = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          nonEmptyAlphanumeric,
          nonEmptyAlphanumeric,
          fc.boolean(),
          (serverKey, clientKey, isProduction) => {
            process.env.MIDTRANS_SERVER_KEY = serverKey;
            process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = clientKey;
            process.env.MIDTRANS_IS_PRODUCTION = isProduction ? "true" : "false";

            const config = getClientMidtransConfig();

            // Should contain client-safe fields
            expect(config.clientKey).toBe(clientKey);
            expect(config.snapUrl).toBeDefined();
            expect(config.isProduction).toBe(isProduction);

            // Should NOT contain server key
            expect((config as Record<string, unknown>).serverKey).toBeUndefined();
            expect((config as Record<string, unknown>).apiUrl).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("validateMidtransConfig", () => {
    it("should not throw when all config is valid", () => {
      process.env.MIDTRANS_SERVER_KEY = "test-server-key";
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "test-client-key";

      expect(() => validateMidtransConfig()).not.toThrow();
    });

    it("should throw when config is invalid", () => {
      delete process.env.MIDTRANS_SERVER_KEY;
      delete process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

      expect(() => validateMidtransConfig()).toThrow(MidtransConfigError);
    });
  });
});

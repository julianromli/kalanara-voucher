/**
 * Midtrans Payment Gateway Configuration
 * @description Environment-aware configuration for Midtrans integration
 * 
 * Environment Variables Required:
 * - MIDTRANS_SERVER_KEY: Server key for server-to-server authentication (server-side only)
 * - NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: Client key for Snap.js initialization (exposed to frontend)
 * - MIDTRANS_IS_PRODUCTION: "true" for production, anything else for sandbox
 */

export interface MidtransConfig {
  readonly isProduction: boolean;
  readonly serverKey: string;
  readonly clientKey: string;
  readonly snapUrl: string;
  readonly apiUrl: string;
}

export class MidtransConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MidtransConfigError";
  }
}

/**
 * Validates that a required environment variable is present
 * @throws MidtransConfigError if the variable is missing or empty
 */
function requireEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new MidtransConfigError(
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * Get Midtrans configuration based on environment variables
 * @throws MidtransConfigError if required environment variables are missing
 * @returns MidtransConfig object with all configuration values
 */
export function getMidtransConfig(): MidtransConfig {
  const serverKey = requireEnvVar(
    "MIDTRANS_SERVER_KEY",
    process.env.MIDTRANS_SERVER_KEY
  );
  
  const clientKey = requireEnvVar(
    "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
  );

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  const snapUrl = isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  const apiUrl = isProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";

  return {
    isProduction,
    serverKey,
    clientKey,
    snapUrl,
    apiUrl,
  };
}

/**
 * Get client-side Midtrans configuration (safe to expose to frontend)
 * @throws MidtransConfigError if client key is missing
 * @returns Object with clientKey and snapUrl only
 */
export function getClientMidtransConfig(): Pick<MidtransConfig, "clientKey" | "snapUrl" | "isProduction"> {
  const clientKey = requireEnvVar(
    "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY",
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
  );

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  const snapUrl = isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  return {
    clientKey,
    snapUrl,
    isProduction,
  };
}

/**
 * Validate that all required Midtrans environment variables are set
 * Call this at application startup to fail fast if configuration is missing
 * @throws MidtransConfigError if any required variable is missing
 */
export function validateMidtransConfig(): void {
  getMidtransConfig();
}

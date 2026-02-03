/**
 * Mayar Payment Gateway Configuration
 * @description Environment-aware configuration for Mayar.id integration
 *
 * Environment Variables Required:
 * - MAYAR_API_KEY: API key from web.mayar.id/api-keys (server-side only)
 * - MAYAR_IS_PRODUCTION: "true" for production, anything else for sandbox
 */

export interface MayarConfig {
  readonly isProduction: boolean;
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly webhookSecret: string | null;
}

export class MayarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MayarConfigError";
  }
}

function requireEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new MayarConfigError(
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

export function getMayarConfig(): MayarConfig {
  const apiKey = requireEnvVar("MAYAR_API_KEY", process.env.MAYAR_API_KEY);

  const isProduction = process.env.MAYAR_IS_PRODUCTION === "true";

  const apiUrl = isProduction
    ? "https://api.mayar.id/hl/v1"
    : "https://api.mayar.club/hl/v1";

  // Webhook secret is optional but highly recommended for security
  const webhookSecret = process.env.MAYAR_WEBHOOK_SECRET || null;

  return {
    isProduction,
    apiKey,
    apiUrl,
    webhookSecret,
  };
}

export function validateMayarConfig(): void {
  getMayarConfig();
}

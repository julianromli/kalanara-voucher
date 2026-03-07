import "server-only";

import {
  SCALEV_PAYMENT_METHODS,
  SCALEV_VA_BANK_CODES,
  type ScalevCheckoutConfig,
  type ScalevPaymentMethod,
  type ScalevPaymentOption,
  type ScalevVABankCode,
} from "@/lib/scalev/types";

const DEFAULT_STORE_UNIQUE_ID = "store_uFfyn8rkIwuwWbHAKVYeRjOi";
const DEFAULT_API_BASE_URL = "https://api.scalev.id/v2";

export interface ScalevConfig {
  apiBaseUrl: string;
  apiKey: string;
  storeUniqueId: string;
  storeNameSearch: string;
  fallbackPaymentMethods: ScalevPaymentMethod[];
  fallbackVABanks: ScalevVABankCode[];
}

class ScalevConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScalevConfigError";
  }
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new ScalevConfigError(
      `Missing required environment variable: ${name}`
    );
  }

  return value.trim();
}

function parsePaymentMethods(value: string | undefined): ScalevPaymentMethod[] {
  if (!value) {
    return [...SCALEV_PAYMENT_METHODS];
  }

  const allowed = new Set<ScalevPaymentMethod>(SCALEV_PAYMENT_METHODS);
  const parsed = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ScalevPaymentMethod => allowed.has(item as ScalevPaymentMethod));

  return parsed.length > 0 ? parsed : [...SCALEV_PAYMENT_METHODS];
}

function parseVABanks(value: string | undefined): ScalevVABankCode[] {
  if (!value) {
    return [...SCALEV_VA_BANK_CODES];
  }

  const allowed = new Set<ScalevVABankCode>(SCALEV_VA_BANK_CODES);
  const parsed = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is ScalevVABankCode => allowed.has(item as ScalevVABankCode));

  return parsed.length > 0 ? parsed : [...SCALEV_VA_BANK_CODES];
}

export function getScalevConfig(): ScalevConfig {
  return {
    apiBaseUrl:
      process.env.SCALEV_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    apiKey: requireEnv("SCALEV_API_KEY", process.env.SCALEV_API_KEY),
    storeUniqueId:
      process.env.SCALEV_STORE_UNIQUE_ID?.trim() || DEFAULT_STORE_UNIQUE_ID,
    storeNameSearch: process.env.SCALEV_STORE_NAME?.trim() || "Kalanara Spa",
    fallbackPaymentMethods: parsePaymentMethods(
      process.env.SCALEV_PAYMENT_METHODS
    ),
    fallbackVABanks: parseVABanks(process.env.SCALEV_VA_BANKS),
  };
}

function labelForMethod(method: ScalevPaymentMethod): string {
  switch (method) {
    case "qris":
      return "QRIS";
    case "invoice":
      return "Transfer Bank (Invoice)";
    case "va":
      return "Virtual Account";
    case "gopay":
      return "GoPay";
    case "ovo":
      return "OVO";
    case "dana":
      return "DANA";
    case "shopeepay":
      return "ShopeePay";
    case "linkaja":
      return "LinkAja";
    default:
      return method;
  }
}

export function buildCheckoutConfig(
  paymentMethods: ScalevPaymentMethod[],
  subPaymentMethods: ScalevVABankCode[]
): ScalevCheckoutConfig {
  const options: ScalevPaymentOption[] = paymentMethods.map((method) => ({
    code: method,
    label: labelForMethod(method),
    subMethods: method === "va" ? subPaymentMethods : undefined,
  }));

  return {
    storeUniqueId: getScalevConfig().storeUniqueId,
    paymentOptions: options,
  };
}

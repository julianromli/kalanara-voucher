import "server-only";

import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevCheckoutConfig,
  ScalevPaymentMethod,
  ScalevUnavailableCheckoutConfig,
  ScalevVABankCode,
} from "@/lib/scalev/types";

const CHECKOUT_CONFIG_TIMEOUT_MS = 5_000;

export function getUnavailableScalevCheckoutConfig(): ScalevUnavailableCheckoutConfig {
  return {
    availability: "unavailable",
    storeUniqueId: "",
    paymentOptions: [],
  };
}

export async function getScalevCheckoutConfig(): Promise<ScalevCheckoutConfig> {
  const availability = await getScalevCheckoutAvailability(
    AbortSignal.timeout(CHECKOUT_CONFIG_TIMEOUT_MS)
  );
  const config = getScalevConfig();

  return buildCheckoutConfig(
    availability.paymentMethods as ScalevPaymentMethod[],
    availability.subPaymentMethods as ScalevVABankCode[],
    config.disabledPaymentMethods
  );
}

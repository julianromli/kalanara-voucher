import "server-only";

import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevCheckoutConfig,
  ScalevUnavailableCheckoutConfig,
} from "@/lib/scalev/types";
import {
  isScalevPaymentMethod,
  isScalevVABankCode,
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
  const paymentMethods = [
    ...new Set(
      availability.paymentMethods
        .filter(isScalevPaymentMethod)
        .filter((method) => !config.disabledPaymentMethods.includes(method))
    ),
  ];
  const subPaymentMethods = [
    ...new Set(availability.subPaymentMethods.filter(isScalevVABankCode)),
  ];

  return buildCheckoutConfig(
    paymentMethods,
    subPaymentMethods,
    config.disabledPaymentMethods,
    availability.source
  );
}

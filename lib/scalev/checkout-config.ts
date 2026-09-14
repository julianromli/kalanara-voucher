import "server-only";

import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import type {
  ScalevCheckoutConfig,
  ScalevPaymentMethod,
  ScalevVABankCode,
} from "@/lib/scalev/types";

export async function getScalevCheckoutConfig(): Promise<ScalevCheckoutConfig> {
  const availability = await getScalevCheckoutAvailability();
  const config = getScalevConfig();

  return buildCheckoutConfig(
    availability.paymentMethods as ScalevPaymentMethod[],
    availability.subPaymentMethods as ScalevVABankCode[],
    config.disabledPaymentMethods
  );
}

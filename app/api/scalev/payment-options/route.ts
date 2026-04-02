import { connection, NextResponse } from "next/server";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import type { ScalevPaymentMethod, ScalevVABankCode } from "@/lib/scalev/types";

export async function GET() {
  await connection();

  try {
    const availability = await getScalevCheckoutAvailability();
    const config = getScalevConfig();

    return NextResponse.json({
      success: true,
      config: buildCheckoutConfig(
        availability.paymentMethods as ScalevPaymentMethod[],
        availability.subPaymentMethods as ScalevVABankCode[],
        config.disabledPaymentMethods
      ),
    });
  } catch (error) {
    console.error("[Scalev] Failed to load payment options:", error);

    const fallback = getScalevConfig();
    const fallbackMethods = fallback.fallbackPaymentMethods.filter(
      (method) => !fallback.disabledPaymentMethods.includes(method)
    );

    return NextResponse.json({
      success: true,
      config: buildCheckoutConfig(
        fallbackMethods,
        fallback.fallbackVABanks,
        fallback.disabledPaymentMethods
      ),
    });
  }
}

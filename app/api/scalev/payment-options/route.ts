import { NextResponse } from "next/server";
import { buildCheckoutConfig, getScalevConfig } from "@/lib/scalev/config";
import { getScalevCheckoutAvailability } from "@/lib/scalev/client";
import type { ScalevPaymentMethod, ScalevVABankCode } from "@/lib/scalev/types";

export async function GET() {
  try {
    const availability = await getScalevCheckoutAvailability();

    return NextResponse.json({
      success: true,
      config: buildCheckoutConfig(
        availability.paymentMethods as ScalevPaymentMethod[],
        availability.subPaymentMethods as ScalevVABankCode[]
      ),
    });
  } catch (error) {
    console.error("[Scalev] Failed to load payment options:", error);

    const fallback = getScalevConfig();
    return NextResponse.json({
      success: true,
      config: buildCheckoutConfig(
        fallback.fallbackPaymentMethods,
        fallback.fallbackVABanks
      ),
    });
  }
}

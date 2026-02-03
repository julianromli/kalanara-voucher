/**
 * Mayar API Client
 * @description HTTP client for Mayar.id payment gateway
 */

import { getMayarConfig } from "./config";
import type {
  MayarCreatePaymentRequest,
  MayarCreatePaymentResponse,
} from "./types";

export async function createMayarPayment(
  request: MayarCreatePaymentRequest
): Promise<MayarCreatePaymentResponse | null> {
  const config = getMayarConfig();

  try {
    const response = await fetch(`${config.apiUrl}/payment/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Mayar API] Error response:", response.status, errorData);
      return null;
    }

    const data = (await response.json()) as MayarCreatePaymentResponse;

    if (data.statusCode !== 200) {
      console.error("[Mayar API] Non-200 status:", data);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[Mayar API] Request failed:", error);
    return null;
  }
}

export function calculatePaymentExpiry(): string {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate.toISOString();
}

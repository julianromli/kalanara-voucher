import { NextRequest, NextResponse } from "next/server";
import { getServiceById } from "@/lib/actions/services";
import { validateDiscountForCheckout } from "@/lib/discounts/service";
import type { DiscountCodePreviewResponse } from "@/lib/scalev/types";

interface DiscountPreviewRequest {
  customerEmail: string;
  customerPhone: string;
  discountCode: string;
  serviceIds: string[];
}

const MAX_PREVIEW_SERVICE_IDS = 20;

function getOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function validateRequest(body: unknown): DiscountPreviewRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;
  const customerEmail = getOptionalString(data.customerEmail);
  const customerPhone = getOptionalString(data.customerPhone);
  const discountCode = getOptionalString(data.discountCode);
  const serviceIds = Array.isArray(data.serviceIds)
    ? Array.from(
        new Set(
          data.serviceIds
            .map((value) => getOptionalString(value))
            .filter((value): value is string => Boolean(value))
        )
      )
    : [];

  if (
    !customerEmail ||
    !customerPhone ||
    !discountCode ||
    serviceIds.length === 0 ||
    serviceIds.length > MAX_PREVIEW_SERVICE_IDS
  ) {
    return null;
  }

  return {
    customerEmail,
    customerPhone,
    discountCode,
    serviceIds,
  };
}

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    { success: false, error } satisfies DiscountCodePreviewResponse,
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<DiscountCodePreviewResponse>> {
  try {
    const body = await request.json().catch(() => null);
    const validatedData = validateRequest(body);

    if (!validatedData) {
      return errorResponse("Data kode diskon tidak valid.", 400);
    }

    const services = await Promise.all(
      validatedData.serviceIds.map((serviceId) => getServiceById(serviceId))
    );

    if (services.some((service) => !service || !service.is_active)) {
      return errorResponse("Layanan tidak tersedia.", 404);
    }

    const subtotalAmount = services.reduce(
      (sum, service) => sum + (service?.price ?? 0),
      0
    );
    const validation = await validateDiscountForCheckout({
      discountCode: validatedData.discountCode,
      subtotalAmount,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
    });

    if (!validation.valid) {
      return errorResponse(validation.message, 400);
    }

    return NextResponse.json({
      success: true,
      pricing: {
        code: validation.quote.code,
        discountType: validation.quote.discountType,
        discountValue: validation.quote.discountValue,
        subtotalAmount: validation.quote.subtotalAmount,
        discountAmount: validation.quote.discountAmount,
        totalAmount: validation.quote.totalAmount,
      },
    });
  } catch (error) {
    console.error("[DiscountCode] preview failed:", error);
    return errorResponse("Gagal memeriksa kode diskon. Silakan coba lagi.", 500);
  }
}

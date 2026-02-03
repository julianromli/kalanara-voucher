/**
 * Mayar Create Payment API Route
 *
 * Creates a pending order and generates a payment link for redirect
 *
 * POST /api/mayar/create-payment
 */

import { NextRequest, NextResponse } from "next/server";
import { getMayarConfig } from "@/lib/mayar/config";
import { createMayarPayment, calculatePaymentExpiry } from "@/lib/mayar/client";
import { createPendingOrder, updateOrderPaymentLink } from "@/lib/actions/orders";
import { getServiceById } from "@/lib/actions/services";
import { DeliveryMethod, SendTo } from "@/lib/types";
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  MayarCreatePaymentRequest,
  PendingOrderData,
} from "@/lib/mayar/types";

function validateRequest(body: unknown): CreatePaymentRequest | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = body as Record<string, unknown>;

  // Required fields
  const requiredFields = [
    "serviceId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "recipientName",
    "recipientPhone",
    "deliveryMethod",
    "sendTo",
  ];

  for (const field of requiredFields) {
    if (
      !data[field] ||
      (typeof data[field] === "string" && data[field].toString().trim() === "")
    ) {
      return null;
    }
  }

  // Validate delivery method
  const deliveryMethodStr = data.deliveryMethod as string;
  if (
    !Object.values(DeliveryMethod).includes(deliveryMethodStr as DeliveryMethod)
  ) {
    return null;
  }

  // Validate sendTo
  const sendToStr = data.sendTo as string;
  if (!Object.values(SendTo).includes(sendToStr as SendTo)) {
    return null;
  }

  return {
    serviceId: data.serviceId as string,
    customerName: data.customerName as string,
    customerEmail: data.customerEmail as string,
    customerPhone: data.customerPhone as string,
    recipientName: data.recipientName as string,
    recipientEmail: data.recipientEmail as string | undefined,
    recipientPhone: data.recipientPhone as string,
    senderMessage: data.senderMessage as string | undefined,
    deliveryMethod: deliveryMethodStr as DeliveryMethod,
    sendTo: sendToStr as SendTo,
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreatePaymentResponse>> {
  try {
    // Parse request body
    const body = await request.json().catch(() => null);

    // Validate request
    const validatedData = validateRequest(body);
    if (!validatedData) {
      return NextResponse.json(
        { success: false, error: "Data tidak lengkap atau tidak valid" },
        { status: 400 }
      );
    }

    // Get service details
    const service = await getServiceById(validatedData.serviceId);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Layanan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!service.is_active) {
      return NextResponse.json(
        { success: false, error: "Layanan tidak tersedia" },
        { status: 400 }
      );
    }

    // Validate Mayar config exists
    try {
      getMayarConfig();
    } catch {
      console.error("Mayar configuration error");
      return NextResponse.json(
        { success: false, error: "Layanan pembayaran tidak tersedia" },
        { status: 502 }
      );
    }

    // Create pending order in database
    const pendingOrderData: PendingOrderData = {
      service_id: validatedData.serviceId,
      customer_email: validatedData.customerEmail,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.customerPhone,
      recipient_name: validatedData.recipientName,
      recipient_email: validatedData.recipientEmail,
      recipient_phone: validatedData.recipientPhone,
      sender_message: validatedData.senderMessage,
      delivery_method: validatedData.deliveryMethod,
      send_to: validatedData.sendTo,
      total_amount: service.price,
    };

    const order = await createPendingOrder(pendingOrderData);
    if (!order || !order.payment_order_id) {
      console.error("Failed to create pending order");
      return NextResponse.json(
        { success: false, error: "Gagal membuat pesanan" },
        { status: 500 }
      );
    }

    // Build Mayar payment request
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUrl = `${appUrl}/checkout/success?order_id=${order.payment_order_id}`;

    const mayarRequest: MayarCreatePaymentRequest = {
      name: `${validatedData.customerName} - ${order.payment_order_id}`,
      email: validatedData.customerEmail,
      amount: service.price,
      mobile: validatedData.customerPhone,
      redirectUrl,
      description: `Voucher Spa - ${service.name} | Order: ${order.payment_order_id}`,
      expiredAt: calculatePaymentExpiry(),
    };

    // Create payment with Mayar
    const mayarResponse = await createMayarPayment(mayarRequest);
    if (!mayarResponse) {
      return NextResponse.json(
        { success: false, error: "Gagal menghubungi layanan pembayaran" },
        { status: 502 }
      );
    }

    // Store payment link and transaction ID in order record
    const updateSuccess = await updateOrderPaymentLink(
      order.id,
      mayarResponse.data.link,
      mayarResponse.data.transactionId
    );
    
    if (!updateSuccess) {
      console.warn(
        `[Mayar] Failed to update order ${order.id} with payment link, continuing anyway`
      );
    }

    return NextResponse.json({
      success: true,
      paymentLink: mayarResponse.data.link,
      orderId: order.payment_order_id,
    });
  } catch (error) {
    console.error("Unexpected error in create-payment:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}

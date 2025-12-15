/**
 * Midtrans Create Transaction API Route
 * 
 * Creates a pending order and generates a Snap token for payment
 * 
 * POST /api/midtrans/create-transaction
 * 
 * @see Design Document: app/api/midtrans/create-transaction/route.ts
 * Requirements: 2.1, 2.2, 2.3, 2.4, 8.1
 */

import { NextRequest, NextResponse } from "next/server";
import { getMidtransConfig } from "@/lib/midtrans/config";
import { createPendingOrder } from "@/lib/actions/orders";
import { getServiceById } from "@/lib/actions/services";
import { DeliveryMethod, SendTo } from "@/lib/types";
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
  MidtransTransactionRequest,
  PendingOrderData,
} from "@/lib/midtrans/types";

/**
 * Validate required fields in the request body
 */
function validateRequest(body: unknown): CreateTransactionRequest | null {
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
    if (!data[field] || (typeof data[field] === "string" && data[field].toString().trim() === "")) {
      return null;
    }
  }

  // Validate delivery method
  const deliveryMethodStr = data.deliveryMethod as string;
  if (!Object.values(DeliveryMethod).includes(deliveryMethodStr as DeliveryMethod)) {
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

/**
 * Split customer name into first and last name
 */
function splitName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Call Midtrans Snap API to create transaction token
 */
async function createSnapToken(
  transactionRequest: MidtransTransactionRequest,
  config: ReturnType<typeof getMidtransConfig>
): Promise<{ token: string; redirect_url: string } | null> {
  const authString = Buffer.from(`${config.serverKey}:`).toString("base64");

  try {
    const response = await fetch(`${config.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(transactionRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Midtrans API error:", response.status, errorData);
      return null;
    }

    const data = await response.json();
    return {
      token: data.token,
      redirect_url: data.redirect_url,
    };
  } catch (error) {
    console.error("Error calling Midtrans API:", error);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateTransactionResponse>> {
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

    // Get Midtrans config
    let config;
    try {
      config = getMidtransConfig();
    } catch {
      console.error("Midtrans configuration error");
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
    if (!order || !order.midtrans_order_id) {
      console.error("Failed to create pending order");
      return NextResponse.json(
        { success: false, error: "Gagal membuat pesanan" },
        { status: 500 }
      );
    }

    // Build Midtrans transaction request
    const { firstName, lastName } = splitName(validatedData.customerName);
    
    const transactionRequest: MidtransTransactionRequest = {
      transaction_details: {
        order_id: order.midtrans_order_id,
        gross_amount: service.price,
      },
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email: validatedData.customerEmail,
        phone: validatedData.customerPhone,
      },
      item_details: [
        {
          id: service.id,
          name: service.name,
          price: service.price,
          quantity: 1,
        },
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order_id=${order.midtrans_order_id}`,
      },
    };

    // Create Snap token
    const snapResult = await createSnapToken(transactionRequest, config);
    if (!snapResult) {
      return NextResponse.json(
        { success: false, error: "Gagal menghubungi layanan pembayaran" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      token: snapResult.token,
      orderId: order.midtrans_order_id,
    });
  } catch (error) {
    console.error("Unexpected error in create-transaction:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}

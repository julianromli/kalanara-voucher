/**
 * Order Status Update API
 * @description Allows admin users to manually update order payment status
 *
 * PATCH /api/orders/[id]/status
 * Body: { status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" }
 *
 * Authentication: Requires authenticated admin user (checked via Supabase session)
 */

import { NextRequest, NextResponse } from "next/server";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  isAdminPermissionError,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { updateOrderStatus } from "@/lib/actions/orders";
import type { PaymentStatus } from "@/lib/database.types";

const VALID_STATUSES: PaymentStatus[] = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: orderId } = await params;

    // Validate order ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || !uuidRegex.test(orderId)) {
      return NextResponse.json(
        { success: false, error: "Invalid order ID format" },
        { status: 400 }
      );
    }

    const access = await requireAdminPermission(
      AdminPermission.ORDERS_UPDATE_PAYMENT_STATUS
    );

    // Parse and validate request body
    let body: { status?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status as PaymentStatus)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` 
        },
        { status: 400 }
      );
    }

    // Update order status using existing server action
    const success = await updateOrderStatus(orderId, status as PaymentStatus);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update order status" },
        { status: 500 }
      );
    }

    console.log(
      `[Order Status] Admin ${access.email} (${access.role}) updated order ${orderId} to ${status}`
    );

    return NextResponse.json({
      success: true,
      data: { orderId, status }
    });
  } catch (error) {
    if (isAdminPermissionError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    console.error("[Order Status API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

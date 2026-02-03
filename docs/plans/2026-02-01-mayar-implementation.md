# Mayar.id Payment Gateway Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from Midtrans to Mayar.id payment gateway with full replacement.

**Architecture:** Redirect-based payment flow. User is redirected to Mayar payment page, then redirected back after payment. Webhook handles order completion.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Mayar.id API

---

## Pre-Implementation Checklist

- [ ] Mayar sandbox account created at https://web.mayar.club
- [ ] Mayar sandbox API key obtained from https://web.mayar.club/api-keys
- [ ] ngrok or localtunnel installed for webhook testing

---

## Task 1: Database Migration

**Files:**
- Create: `lib/supabase/migrations/004_mayar_migration.sql`

**Step 1: Create migration file**

```sql
-- lib/supabase/migrations/004_mayar_migration.sql

-- =============================================
-- Migration: Rename Midtrans columns to generic payment columns
-- For: Mayar.id payment gateway migration
-- Date: 2026-02-01
-- =============================================

-- Rename columns (preserves existing data)
ALTER TABLE orders RENAME COLUMN midtrans_order_id TO payment_order_id;
ALTER TABLE orders RENAME COLUMN midtrans_transaction_id TO payment_transaction_id;
ALTER TABLE orders RENAME COLUMN midtrans_payment_type TO payment_type;
ALTER TABLE orders RENAME COLUMN midtrans_transaction_time TO payment_transaction_time;

-- Add new column for payment link URL
ALTER TABLE orders ADD COLUMN payment_link TEXT;

-- Update column comments
COMMENT ON COLUMN orders.payment_order_id IS 'Unique order ID sent to payment gateway (format: KSP-{timestamp}-{random})';
COMMENT ON COLUMN orders.payment_transaction_id IS 'Transaction ID returned by payment gateway';
COMMENT ON COLUMN orders.payment_type IS 'Payment method used (e.g., qris, bank_transfer, e_wallet)';
COMMENT ON COLUMN orders.payment_transaction_time IS 'Timestamp of payment from gateway';
COMMENT ON COLUMN orders.payment_link IS 'Payment URL for customer redirect (Mayar payment link)';

-- Create partial index for webhook lookup (if not exists)
CREATE INDEX IF NOT EXISTS orders_payment_order_id_idx ON orders (payment_order_id)
  WHERE payment_order_id IS NOT NULL;
```

**Step 2: Run migration in Supabase**

Run: Open Supabase Dashboard > SQL Editor > Paste and execute migration

Expected: All columns renamed, no errors

**Step 3: Commit migration file**

```bash
git add lib/supabase/migrations/004_mayar_migration.sql
git commit -m "chore(db): add migration for Mayar payment gateway"
```

---

## Task 2: Create Mayar Config

**Files:**
- Create: `lib/mayar/config.ts`

**Step 1: Create config file**

```typescript
// lib/mayar/config.ts

/**
 * Mayar Payment Gateway Configuration
 * @description Environment-aware configuration for Mayar.id integration
 *
 * Environment Variables Required:
 * - MAYAR_API_KEY: API key from web.mayar.id/api-keys (server-side only)
 * - MAYAR_IS_PRODUCTION: "true" for production, anything else for sandbox
 */

export interface MayarConfig {
  readonly isProduction: boolean;
  readonly apiKey: string;
  readonly apiUrl: string;
}

export class MayarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MayarConfigError";
  }
}

/**
 * Validates that a required environment variable is present
 * @throws MayarConfigError if the variable is missing or empty
 */
function requireEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new MayarConfigError(
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * Get Mayar configuration based on environment variables
 * @throws MayarConfigError if required environment variables are missing
 * @returns MayarConfig object with all configuration values
 */
export function getMayarConfig(): MayarConfig {
  const apiKey = requireEnvVar("MAYAR_API_KEY", process.env.MAYAR_API_KEY);

  const isProduction = process.env.MAYAR_IS_PRODUCTION === "true";

  const apiUrl = isProduction
    ? "https://api.mayar.id/hl/v1"
    : "https://api.mayar.club/hl/v1";

  return {
    isProduction,
    apiKey,
    apiUrl,
  };
}

/**
 * Validate that all required Mayar environment variables are set
 * Call this at application startup to fail fast if configuration is missing
 * @throws MayarConfigError if any required variable is missing
 */
export function validateMayarConfig(): void {
  getMayarConfig();
}
```

**Step 2: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add lib/mayar/config.ts
git commit -m "feat(mayar): add config module"
```

---

## Task 3: Create Mayar Types

**Files:**
- Create: `lib/mayar/types.ts`

**Step 1: Create types file**

```typescript
// lib/mayar/types.ts

/**
 * Mayar Payment Gateway Type Definitions
 * @description TypeScript interfaces for Mayar.id integration
 */

import type { DeliveryMethod, SendTo } from "@/lib/types";

// ============================================================================
// Mayar API Request/Response Types
// ============================================================================

/**
 * Request body for Mayar create payment API
 * @see https://docs.mayar.id/api-reference/reqpayment/create
 */
export interface MayarCreatePaymentRequest {
  /** Customer name */
  readonly name: string;
  /** Customer email for payment receipt */
  readonly email: string;
  /** Payment amount in IDR */
  readonly amount: number;
  /** Customer phone number */
  readonly mobile: string;
  /** URL to redirect after payment */
  readonly redirectUrl: string;
  /** Description of the payment/order */
  readonly description: string;
  /** Expiration datetime in ISO 8601 format */
  readonly expiredAt: string;
}

/**
 * Response from Mayar create payment API
 */
export interface MayarCreatePaymentResponse {
  readonly statusCode: number;
  readonly messages: string;
  readonly data: {
    /** Payment ID from Mayar */
    readonly id: string;
    /** Transaction ID (alias: transaction_id) */
    readonly transactionId: string;
    /** Payment URL for customer redirect */
    readonly link: string;
  };
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Mayar webhook event types
 */
export type MayarWebhookEvent = "payment.received" | "payment.reminder";

/**
 * Mayar payment status
 */
export type MayarPaymentStatus = "SUCCESS" | "PENDING" | "FAILED";

/**
 * Mayar transaction status
 */
export type MayarTransactionStatus = "paid" | "created" | "expired";

/**
 * Webhook payload from Mayar
 * @see https://docs.mayar.id/api-reference/webhook/history
 */
export interface MayarWebhookPayload {
  readonly event: MayarWebhookEvent;
  readonly data: MayarWebhookData;
}

/**
 * Data object in webhook payload
 */
export interface MayarWebhookData {
  readonly id: string;
  readonly transactionId: string;
  readonly status: MayarPaymentStatus;
  readonly transactionStatus: MayarTransactionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly merchantId: string;
  readonly merchantName?: string;
  readonly merchantEmail: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerMobile: string;
  readonly amount: number;
  readonly isAdminFeeBorneByCustomer?: boolean | null;
  readonly isChannelFeeBorneByCustomer?: boolean | null;
  readonly productId: string;
  readonly productName: string;
  readonly productType: string;
  readonly qty: number;
  readonly couponUsed?: string | null;
  readonly paymentMethod?: string | null;
  readonly paymentUrl?: string;
  readonly nettAmount?: number;
}

// ============================================================================
// Internal API Types
// ============================================================================

/**
 * Request body for create-payment API endpoint
 */
export interface CreatePaymentRequest {
  readonly serviceId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly recipientName: string;
  readonly recipientEmail?: string;
  readonly recipientPhone: string;
  readonly senderMessage?: string;
  readonly deliveryMethod: DeliveryMethod;
  readonly sendTo: SendTo;
}

/**
 * Response from create-payment API endpoint
 */
export interface CreatePaymentResponse {
  readonly success: boolean;
  readonly paymentLink?: string;
  readonly orderId?: string;
  readonly error?: string;
}

/**
 * Data required to create a pending order before payment
 */
export interface PendingOrderData {
  readonly service_id: string;
  readonly customer_email: string;
  readonly customer_name: string;
  readonly customer_phone: string;
  readonly recipient_name: string;
  readonly recipient_email?: string;
  readonly recipient_phone: string;
  readonly sender_message?: string;
  readonly delivery_method: DeliveryMethod;
  readonly send_to: SendTo;
  readonly total_amount: number;
}

/**
 * Payment gateway data to store with order after webhook
 */
export interface PaymentGatewayData {
  readonly transaction_id: string;
  readonly payment_type: string;
  readonly transaction_time: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid MayarWebhookPayload
 */
export function isMayarWebhookPayload(
  value: unknown
): value is MayarWebhookPayload {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.event === "string" &&
    (obj.event === "payment.received" || obj.event === "payment.reminder") &&
    typeof obj.data === "object" &&
    obj.data !== null
  );
}

/**
 * Check if webhook data indicates successful payment
 */
export function isSuccessfulPayment(data: MayarWebhookData): boolean {
  return data.status === "SUCCESS" && data.transactionStatus === "paid";
}
```

**Step 2: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add lib/mayar/types.ts
git commit -m "feat(mayar): add TypeScript types"
```

---

## Task 4: Create Mayar API Client

**Files:**
- Create: `lib/mayar/client.ts`

**Step 1: Create client file**

```typescript
// lib/mayar/client.ts

/**
 * Mayar API Client
 * @description HTTP client for Mayar.id payment gateway
 */

import { getMayarConfig } from "./config";
import type {
  MayarCreatePaymentRequest,
  MayarCreatePaymentResponse,
} from "./types";

/**
 * Create a payment request with Mayar
 * @param request Payment request data
 * @returns Payment response with link for redirect
 */
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

/**
 * Calculate payment expiry datetime (24 hours from now)
 * @returns ISO 8601 datetime string
 */
export function calculatePaymentExpiry(): string {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate.toISOString();
}
```

**Step 2: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add lib/mayar/client.ts
git commit -m "feat(mayar): add API client"
```

---

## Task 5: Create Payment API Route

**Files:**
- Create: `app/api/mayar/create-payment/route.ts`

**Step 1: Create the API route**

```typescript
// app/api/mayar/create-payment/route.ts

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
import { createPendingOrder } from "@/lib/actions/orders";
import { getServiceById } from "@/lib/actions/services";
import { DeliveryMethod, SendTo } from "@/lib/types";
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  MayarCreatePaymentRequest,
  PendingOrderData,
} from "@/lib/mayar/types";

/**
 * Validate required fields in the request body
 */
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

    // Get Mayar config
    let config;
    try {
      config = getMayarConfig();
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
      name: validatedData.customerName,
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

    // TODO: Optionally store payment link in order for reference
    // await updateOrderPaymentLink(order.id, mayarResponse.data.link);

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
```

**Step 2: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: Will fail due to missing `createPendingOrder` update - we'll fix in Task 7

**Step 3: Commit (after Task 7)**

---

## Task 6: Create Webhook API Route

**Files:**
- Create: `app/api/mayar/webhook/route.ts`

**Step 1: Create the webhook route**

```typescript
// app/api/mayar/webhook/route.ts

/**
 * Mayar Webhook Handler
 * @description Handles payment notifications from Mayar
 *
 * This endpoint receives POST requests from Mayar when payment status changes.
 * It validates the payload, updates order status, and triggers voucher creation.
 *
 * @see https://docs.mayar.id/api-reference/webhook/history
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isMayarWebhookPayload,
  isSuccessfulPayment,
  type MayarWebhookPayload,
  type PaymentGatewayData,
} from "@/lib/mayar/types";
import {
  getOrderByPaymentOrderId,
  updateOrderPaymentStatus,
} from "@/lib/actions/orders";
import { createVoucherOnPaymentSuccess } from "@/lib/payment/voucher-service";

/**
 * Extract order ID from webhook description
 * Format: "Voucher Spa - {serviceName} | Order: {orderId}"
 */
function extractOrderIdFromDescription(productName: string): string | null {
  // Try to extract from description pattern
  const match = productName.match(/Order:\s*(KSP-[\w-]+)/i);
  return match ? match[1] : null;
}

/**
 * POST /api/mayar/webhook
 *
 * Webhook endpoint for Mayar payment notifications.
 * Always returns HTTP 200 to prevent Mayar from retrying (except for server errors).
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.error("[Mayar Webhook] Invalid JSON body");
      return NextResponse.json(
        { status: "error", message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Validate webhook payload structure
    if (!isMayarWebhookPayload(body)) {
      console.error("[Mayar Webhook] Invalid payload structure:", body);
      // Return 200 to prevent retries for malformed requests
      return NextResponse.json({
        status: "ok",
        message: "Invalid payload structure",
      });
    }

    const payload = body as MayarWebhookPayload;
    const { event, data } = payload;

    console.log(
      `[Mayar Webhook] Received ${event} for transaction ${data.transactionId}`
    );

    // Only process payment.received events
    if (event !== "payment.received") {
      console.log(`[Mayar Webhook] Ignoring event type: ${event}`);
      return NextResponse.json({ status: "ok", message: "Event ignored" });
    }

    // Validate payment status
    if (!isSuccessfulPayment(data)) {
      console.log(
        `[Mayar Webhook] Payment not successful: status=${data.status}, transactionStatus=${data.transactionStatus}`
      );
      return NextResponse.json({ status: "ok", message: "Payment not successful" });
    }

    // Extract order ID from product name/description
    const orderId = extractOrderIdFromDescription(data.productName);
    if (!orderId) {
      console.warn(
        `[Mayar Webhook] Could not extract order ID from: ${data.productName}`
      );
      return NextResponse.json({ status: "ok", message: "Order ID not found in description" });
    }

    console.log(`[Mayar Webhook] Processing order: ${orderId}`);

    // Look up order by payment order ID
    const order = await getOrderByPaymentOrderId(orderId);
    if (!order) {
      console.warn(`[Mayar Webhook] Order not found: ${orderId}`);
      return NextResponse.json({ status: "ok", message: "Order not found" });
    }

    // Idempotency check: skip if already in final state
    if (
      order.payment_status === "COMPLETED" ||
      order.payment_status === "REFUNDED"
    ) {
      console.log(
        `[Mayar Webhook] Order ${order.id} already in final state: ${order.payment_status}`
      );
      return NextResponse.json({ status: "ok", message: "Already processed" });
    }

    // Prepare payment data for storage
    const paymentData: PaymentGatewayData = {
      transaction_id: data.transactionId,
      payment_type: data.paymentMethod || "unknown",
      transaction_time: data.updatedAt || new Date().toISOString(),
    };

    // Update order status
    const updateSuccess = await updateOrderPaymentStatus(
      order.id,
      "COMPLETED",
      paymentData
    );
    if (!updateSuccess) {
      console.error(`[Mayar Webhook] Failed to update order ${order.id}`);
      return NextResponse.json(
        { status: "error", message: "Failed to update order" },
        { status: 500 }
      );
    }

    // Create voucher and trigger delivery
    console.log(
      `[Mayar Webhook] Payment successful for order ${order.id}, creating voucher...`
    );

    try {
      const voucherResult = await createVoucherOnPaymentSuccess(order);
      if (voucherResult.success) {
        console.log(`[Mayar Webhook] Voucher created: ${voucherResult.voucherId}`);
      } else {
        console.error(
          `[Mayar Webhook] Voucher creation failed: ${voucherResult.error}`
        );
        // Don't fail the webhook - order is already marked as completed
      }
    } catch (error) {
      console.error(`[Mayar Webhook] Voucher creation error:`, error);
      // Don't fail the webhook
    }

    console.log(`[Mayar Webhook] Successfully processed order ${orderId}`);
    return NextResponse.json({ status: "ok", message: "Notification processed" });
  } catch (error) {
    console.error("[Mayar Webhook] Unexpected error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: Will fail due to missing imports - we'll fix in Task 7 and 8

**Step 3: Commit (after Task 8)**

---

## Task 7: Update Orders Actions

**Files:**
- Modify: `lib/actions/orders.ts`

**Step 1: Update imports and rename functions**

Replace the Midtrans-specific import and function names with generic payment gateway names.

Find and replace in `lib/actions/orders.ts`:

1. Change import:
```typescript
// OLD:
import type { PendingOrderData, MidtransPaymentData } from "@/lib/midtrans/types";

// NEW:
import type { PendingOrderData, PaymentGatewayData } from "@/lib/mayar/types";
```

2. Rename `generateMidtransOrderId` to `generatePaymentOrderId`

3. Rename `checkMidtransOrderIdExists` to `checkPaymentOrderIdExists`

4. Rename `generateUniqueMidtransOrderId` to `generateUniquePaymentOrderId`

5. Update `createPendingOrder` to use new column name:
```typescript
// OLD:
midtrans_order_id: midtransOrderId,

// NEW:
payment_order_id: paymentOrderId,
```

6. Rename `getOrderByMidtransOrderId` to `getOrderByPaymentOrderId`:
```typescript
// OLD:
export async function getOrderByMidtransOrderId(midtransOrderId: string)

// NEW:
export async function getOrderByPaymentOrderId(paymentOrderId: string)
```

7. Update `updateOrderPaymentStatus` to use generic payment data:
```typescript
// OLD:
midtransData?: MidtransPaymentData

// NEW:
paymentData?: PaymentGatewayData
```

**Step 2: Full updated file content**

See the complete updated `lib/actions/orders.ts` file below.

**Step 3: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: May still have errors due to database types - need to regenerate

**Step 4: Commit**

```bash
git add lib/actions/orders.ts
git commit -m "refactor(orders): rename Midtrans functions to generic payment gateway"
```

---

## Task 8: Move Voucher Service

**Files:**
- Create: `lib/payment/voucher-service.ts` (copy from `lib/midtrans/voucher-service.ts`)

**Step 1: Create payment directory and copy file**

```bash
mkdir -p lib/payment
cp lib/midtrans/voucher-service.ts lib/payment/voucher-service.ts
```

**Step 2: Update file header comment**

```typescript
// OLD:
/**
 * Voucher Service for Midtrans Payment Integration
 * @description Handles voucher creation and delivery after successful payment
 */

// NEW:
/**
 * Voucher Service for Payment Gateway Integration
 * @description Handles voucher creation and delivery after successful payment
 */
```

**Step 3: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: No errors (file is generic, no Midtrans-specific code)

**Step 4: Commit**

```bash
git add lib/payment/voucher-service.ts
git commit -m "feat(payment): move voucher service to generic payment module"
```

---

## Task 9: Update Checkout Page

**Files:**
- Modify: `app/checkout/[id]/page.tsx`

**Step 1: Remove Midtrans hook import and usage**

Remove:
```typescript
import { useMidtransSnap } from "@/hooks/useMidtransSnap";
import type { CreateTransactionRequest, SnapResult } from "@/lib/midtrans/types";
```

Remove the `useMidtransSnap` hook usage:
```typescript
// REMOVE THIS ENTIRE BLOCK:
const { pay, isLoading: isSnapLoading, isReady: isSnapReady, error: snapError } = useMidtransSnap({
  onSuccess: async (result: SnapResult) => {
    // ...
  },
  onPending: (result: SnapResult) => {
    // ...
  },
  onError: (result: SnapResult) => {
    // ...
  },
  onClose: () => {
    // ...
  },
});
```

**Step 2: Update form submission**

Replace the `onSubmit` function with redirect flow:

```typescript
const onSubmit = async (data: CheckoutForm) => {
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    const firstErrorField = errorFields[0] as keyof CheckoutForm;
    setFocus(firstErrorField);
    return;
  }

  setIsProcessing(true);
  formDataRef.current = data;

  try {
    const response = await fetch("/api/mayar/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        recipientPhone: data.recipientPhone,
        senderMessage: data.senderMessage,
        deliveryMethod: data.deliveryMethod,
        sendTo: data.sendTo,
      }),
    });

    const result = await response.json();

    if (!result.success || !result.paymentLink) {
      throw new Error(result.error || "Gagal membuat pembayaran");
    }

    // Redirect to Mayar payment page
    window.location.href = result.paymentLink;
  } catch (error) {
    console.error("Checkout error:", error);
    setIsProcessing(false);
    showToast(
      error instanceof Error
        ? error.message
        : "Gagal memproses pembayaran. Silakan coba lagi.",
      "error"
    );
  }
};
```

**Step 3: Remove unused states and callbacks**

Remove:
- `handlePaymentSuccess` function
- `handlePaymentPending` function
- References to `isSnapReady`, `isSnapLoading`, `snapError`

**Step 4: Verify no TypeScript errors**

Run: `bunx tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add app/checkout/[id]/page.tsx
git commit -m "refactor(checkout): migrate from Midtrans Snap to Mayar redirect flow"
```

---

## Task 10: Update Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (if exists)
- Modify: `AGENTS.md`

**Step 1: Update .env.example**

Replace Midtrans section with Mayar:

```env
# ===========================================
# Mayar Payment Gateway
# ===========================================
# Get your API key from Mayar Dashboard:
# - Sandbox: https://web.mayar.club/api-keys
# - Production: https://web.mayar.id/api-keys

# API Key (KEEP SECRET - server-side only)
MAYAR_API_KEY=your-mayar-api-key-here

# Environment Mode
# Set to "true" for production, "false" or omit for sandbox
MAYAR_IS_PRODUCTION=false
```

**Step 2: Update AGENTS.md**

Update the Environment Variables section in root AGENTS.md.

**Step 3: Commit**

```bash
git add .env.example AGENTS.md
git commit -m "docs: update environment variables for Mayar"
```

---

## Task 11: Delete Midtrans Files

**Files:**
- Delete: `lib/midtrans/` (entire directory)
- Delete: `app/api/midtrans/` (entire directory)
- Delete: `hooks/useMidtransSnap.ts`
- Delete: `docs/midtrans-setup.md`

**Step 1: Delete files**

```bash
rm -rf lib/midtrans/
rm -rf app/api/midtrans/
rm hooks/useMidtransSnap.ts
rm docs/midtrans-setup.md
```

**Step 2: Verify no import errors**

Run: `bunx tsc --noEmit`

Expected: No errors (all imports should be updated)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Midtrans integration files"
```

---

## Task 12: Create Mayar Setup Documentation

**Files:**
- Create: `docs/mayar-setup.md`

**Step 1: Create documentation file**

```markdown
# Mayar.id Payment Gateway Setup

## Overview

Kalanara Spa uses Mayar.id as the payment gateway for processing voucher purchases.
Mayar provides a redirect-based payment flow where customers are redirected to
Mayar's payment page to complete the transaction.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MAYAR_API_KEY` | API key from Mayar dashboard | `myr_xxx...` |
| `MAYAR_IS_PRODUCTION` | Environment mode | `false` for sandbox |

### Getting API Keys

1. **Sandbox (Testing)**
   - Go to https://web.mayar.club
   - Register or login
   - Navigate to API Keys: https://web.mayar.club/api-keys
   - Generate a new API key

2. **Production**
   - Go to https://web.mayar.id
   - Login to your merchant account
   - Navigate to API Keys: https://web.mayar.id/api-keys
   - Generate a new API key

## Webhook Configuration

### Webhook URL

Register the following URL as your webhook endpoint:

- **Development**: `https://your-ngrok-url.ngrok.io/api/mayar/webhook`
- **Production**: `https://your-domain.com/api/mayar/webhook`

### Registering Webhook

Use the Mayar API to register your webhook URL:

```bash
curl --request POST 'https://api.mayar.id/hl/v1/webhook/register' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "url": "https://your-domain.com/api/mayar/webhook"
  }'
```

### Webhook Events

The webhook handler processes these events:
- `payment.received` - Payment successful (triggers voucher creation)
- `payment.reminder` - Payment reminder (ignored)

## Payment Flow

1. Customer fills checkout form
2. Backend creates pending order in database
3. Backend calls Mayar API to create payment request
4. Customer is redirected to Mayar payment page
5. Customer completes payment
6. Mayar redirects customer back to success page
7. Mayar sends webhook notification
8. Backend creates voucher and sends delivery

## Testing

### Sandbox Testing

1. Set `MAYAR_IS_PRODUCTION=false` in `.env.local`
2. Use API key from https://web.mayar.club/api-keys
3. Use ngrok to expose localhost for webhook testing:
   ```bash
   ngrok http 3000
   ```
4. Register ngrok URL as webhook
5. Complete test payment on sandbox

### Test Cards

Mayar sandbox accepts various test payment methods. Check Mayar documentation
for available test credentials.

## Troubleshooting

### Common Issues

1. **"Layanan pembayaran tidak tersedia"**
   - Check `MAYAR_API_KEY` is set correctly
   - Verify API key is valid and not expired

2. **Webhook not received**
   - Verify webhook URL is registered
   - Check ngrok is running (for development)
   - Check server logs for errors

3. **Voucher not created after payment**
   - Check webhook logs for errors
   - Verify order ID extraction from description
   - Check database for order status

## API Reference

- [Mayar API Introduction](https://docs.mayar.id/api-reference/introduction)
- [Create Payment](https://docs.mayar.id/api-reference/reqpayment/create)
- [Webhook](https://docs.mayar.id/api-reference/webhook/history)
```

**Step 2: Commit**

```bash
git add docs/mayar-setup.md
git commit -m "docs: add Mayar setup documentation"
```

---

## Task 13: Regenerate Database Types

**Step 1: Regenerate Supabase types**

Run: `bunx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts`

Or if using linked project:
Run: `bunx supabase gen types typescript --linked > lib/database.types.ts`

**Step 2: Verify updated types**

Check that `payment_order_id`, `payment_transaction_id`, etc. are in the generated types.

**Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "chore(db): regenerate types after migration"
```

---

## Task 14: Final Verification

**Step 1: Run TypeScript check**

Run: `bunx tsc --noEmit`

Expected: No errors

**Step 2: Run linter**

Run: `bun run lint`

Expected: No errors (warnings OK)

**Step 3: Start dev server**

Run: `bun run dev`

Expected: Server starts without errors

**Step 4: Manual testing**

1. Open http://localhost:3000
2. Select a voucher service
3. Fill checkout form
4. Submit - should redirect to Mayar payment page
5. Complete test payment
6. Should redirect back to success page
7. Verify webhook received and voucher created

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Mayar payment gateway migration"
```

---

## Post-Migration Checklist

- [ ] All TypeScript errors resolved
- [ ] Lint passes
- [ ] Dev server runs without errors
- [ ] Checkout redirects to Mayar
- [ ] Webhook processes payments correctly
- [ ] Vouchers created after successful payment
- [ ] Email/WhatsApp delivery works
- [ ] Success page displays voucher details
- [ ] Old Midtrans files deleted
- [ ] Documentation updated

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const ORDER_STATUS_SESSION_TTL_SECONDS = 30 * 60;
const ORDER_STATUS_SESSION_TTL_MS = ORDER_STATUS_SESSION_TTL_SECONDS * 1000;
const NOT_FOUND_ERROR_CODE = "PGRST116";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CreateOrderStatusSessionInput {
  orderId: string;
  /**
   * Test seam for deterministic hashing assertions. Production callers must
   * omit this value so the service generates 32 cryptographically random bytes.
   */
  rawToken?: string;
  now?: Date;
}

interface ResolveActiveOrderStatusSessionInput {
  sessionId: string;
  paymentOrderId: string;
  rawToken: string;
  now?: Date;
}

export interface ActiveOrderStatusSession {
  id: string;
  orderId: string;
  expiresAt: string;
}

function hashStatusToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function getOrderStatusCookieName(sessionId: string): string {
  return `__Host-kalanara-status-${sessionId}`;
}

export function isValidOrderStatusSessionId(sessionId: string): boolean {
  return UUID_PATTERN.test(sessionId);
}

export async function deleteExpiredOrderStatusSessions(
  now = new Date()
): Promise<void> {
  const { error } = await getAdminClient()
    .from("order_status_sessions")
    .delete()
    .lte("expires_at", now.toISOString());

  if (error) {
    throw new Error("Failed to clean expired order status sessions.", {
      cause: error,
    });
  }
}

export function scheduleExpiredOrderStatusSessionCleanup(): void {
  after(async () => {
    try {
      await deleteExpiredOrderStatusSessions();
    } catch {
      console.error("Failed to clean expired order status sessions.");
    }
  });
}

export async function createOrderStatusSession({
  orderId,
  rawToken = randomBytes(32).toString("base64url"),
  now = new Date(),
}: CreateOrderStatusSessionInput): Promise<{
  id: string;
  rawToken: string;
}> {
  const expiresAt = new Date(now.getTime() + ORDER_STATUS_SESSION_TTL_MS);
  const { data, error } = await getAdminClient()
    .from("order_status_sessions")
    .insert({
      order_id: orderId,
      token_hash: hashStatusToken(rawToken),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Failed to create order status session.", {
      cause: error,
    });
  }

  return { id: data.id, rawToken };
}

export async function resolveActiveOrderStatusSession({
  sessionId,
  paymentOrderId,
  rawToken,
  now = new Date(),
}: ResolveActiveOrderStatusSessionInput): Promise<ActiveOrderStatusSession | null> {
  if (!isValidOrderStatusSessionId(sessionId)) {
    return null;
  }

  const { data, error } = await getAdminClient()
    .from("order_status_sessions")
    .select("id, order_id, expires_at, orders!inner(payment_order_id)")
    .eq("id", sessionId)
    .eq("token_hash", hashStatusToken(rawToken))
    .eq("orders.payment_order_id", paymentOrderId)
    .gt("expires_at", now.toISOString())
    .single();

  if (error) {
    if (error.code === NOT_FOUND_ERROR_CODE) {
      return null;
    }

    throw new Error("Failed to resolve order status session.", {
      cause: error,
    });
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    orderId: data.order_id,
    expiresAt: data.expires_at,
  };
}

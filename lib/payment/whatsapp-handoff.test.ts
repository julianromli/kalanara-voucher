import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";

const { queryResult, calls } = vi.hoisted(() => ({
  queryResult: { data: [] as unknown[] | null, error: null as unknown },
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => {
    const builder: Record<string, unknown> = {};
    for (const method of ["from", "select", "eq", "not"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => unknown) => resolve(queryResult);
    return builder;
  },
}));

const voucher = (code: string, deliveryMethod = "BOTH") => ({
  voucherCode: code,
  paymentOrderId: "KSP-1",
  recipientName: "Dias",
  recipientPhone: "0812",
  senderName: "Tri",
  serviceName: "Balinese",
  serviceDuration: 60,
  amount: 1,
  expiryDate: "2027-01-01",
  deliveryMethod,
  sendTo: "RECIPIENT",
});

const payload = (vouchers: ReturnType<typeof voucher>[], status = "completed") =>
  ({
    status,
    orderId: "KSP-1",
    paymentStatus: "COMPLETED",
    voucher: vouchers[0],
    vouchers,
  }) as unknown as PublicOrderStatusPayload;

describe("WhatsApp handoff links", () => {
  beforeEach(() => {
    calls.length = 0;
    queryResult.data = [];
    queryResult.error = null;
  });

  test("attaches the saved wa.me link to the matching voucher only", async () => {
    queryResult.data = [
      { handoff_url: "https://wa.me/6281234567890?text=A", vouchers: { code: "V-1" } },
      { handoff_url: "https://evil.example/6281234567890", vouchers: { code: "V-2" } },
    ];
    const { withWhatsAppHandoffLinks } = await import("@/lib/payment/whatsapp-handoff");

    const result = await withWhatsAppHandoffLinks("order-1", payload([voucher("V-1"), voucher("V-2")]));

    expect(result.vouchers?.[0].whatsappLink).toBe("https://wa.me/6281234567890?text=A");
    expect(result.voucher?.whatsappLink).toBe("https://wa.me/6281234567890?text=A");
    expect(result.vouchers?.[1].whatsappLink).toBeUndefined();
    expect(calls).toContainEqual(["eq", "order_id", "order-1"]);
    expect(calls).toContainEqual(["eq", "channel", "WHATSAPP"]);
  });

  test("skips the lookup for pending orders and email-only vouchers", async () => {
    const { withWhatsAppHandoffLinks } = await import("@/lib/payment/whatsapp-handoff");

    await withWhatsAppHandoffLinks("order-1", payload([voucher("V-1")], "pending"));
    await withWhatsAppHandoffLinks("order-1", payload([voucher("V-1", "EMAIL")]));

    expect(calls).toHaveLength(0);
  });

  test("a read error leaves the payload as it was", async () => {
    queryResult.data = null;
    queryResult.error = { message: "boom" };
    const { withWhatsAppHandoffLinks } = await import("@/lib/payment/whatsapp-handoff");
    const original = payload([voucher("V-1")]);

    await expect(withWhatsAppHandoffLinks("order-1", original)).resolves.toBe(original);
  });

  test("only real wa.me phone links pass", async () => {
    const { isSafeWhatsAppHandoffUrl } = await import("@/lib/payment/whatsapp-handoff");
    expect(isSafeWhatsAppHandoffUrl("https://wa.me/6281234567890?text=x")).toBe(true);
    expect(isSafeWhatsAppHandoffUrl("https://wa.me.evil.com/6281234567890")).toBe(false);
    expect(isSafeWhatsAppHandoffUrl("https://wa.me/abc")).toBe(false);
    expect(isSafeWhatsAppHandoffUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeWhatsAppHandoffUrl(null)).toBe(false);
  });
});

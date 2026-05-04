import { beforeEach, describe, expect, test, vi } from "vitest";
import { DeliveryMethod, SendTo } from "@/lib/types";

const checkSingleMock = vi.fn();
const eqMock = vi.fn(() => ({
  single: checkSingleMock,
}));
const selectMock = vi.fn(() => ({
  eq: eqMock,
}));
const insertSingleMock = vi.fn();
const insertMock = vi.fn(() => ({
  select: vi.fn(() => ({
    single: insertSingleMock,
  })),
}));
const fromMock = vi.fn(() => ({
  select: selectMock,
  insert: insertMock,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  logAdminAudit: vi.fn(),
  requireAdminPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: fromMock,
  }),
}));

vi.mock("@/lib/scalev/mappers", () => ({
  mapScalevPaymentMethodToLocal: vi.fn(() => "BANK_TRANSFER"),
}));

describe("createPendingOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSingleMock.mockResolvedValue({ data: null, error: null });
    insertSingleMock.mockResolvedValue({
      data: { id: "order-1" },
      error: null,
    });
  });

  test("stores recipient_phone as null when it is not relevant", async () => {
    const { createPendingOrder } = await import("@/lib/actions/orders");

    await createPendingOrder({
      service_id: "service-1",
      customer_email: "buyer@example.com",
      customer_name: "Faiz",
      customer_phone: "6281234567890",
      recipient_name: "Penerima",
      recipient_email: undefined,
      recipient_phone: null,
      sender_message: undefined,
      delivery_method: DeliveryMethod.WHATSAPP,
      send_to: SendTo.PURCHASER,
      subtotal_amount: 450000,
      discount_code_id: null,
      discount_code: null,
      discount_type_snapshot: null,
      discount_value_snapshot: null,
      discount_amount: 0,
      total_amount: 450000,
      payment_method: "qris",
      sub_payment_method: undefined,
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_phone: null,
      })
    );
  });
});

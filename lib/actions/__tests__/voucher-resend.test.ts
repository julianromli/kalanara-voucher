import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireAdminPermissionMock,
  logAdminAuditMock,
  getAdminClientMock,
  sendVoucherEmailMessageMock,
  renderVoucherEmailHtmlMock,
} = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  sendVoucherEmailMessageMock: vi.fn(),
  renderVoucherEmailHtmlMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: logAdminAuditMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

vi.mock("@/lib/email/voucher-email", () => ({
  renderVoucherEmailHtml: renderVoucherEmailHtmlMock,
  voucherGiftSubject: () => "gift subject",
  voucherBuyerCopySubject: () => "buyer copy subject",
  sendVoucherEmailMessage: sendVoucherEmailMessageMock,
}));

import {
  getVoucherDeliveryOverview,
  getVoucherWhatsAppLink,
  recordVoucherWhatsAppLinkCopied,
} from "@/lib/actions/voucher-resend";
import { resendVoucherEmailForAdmin as resendVoucherEmail } from "@/lib/voucher-resend/server";
import { AdminPermission } from "@/lib/auth/admin-rbac";

// Hand-seeded ids fail the RFC 4122 version check; the action must accept them.
const ORDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VOUCHER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ITEM_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const RESEND_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const access = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "kasir@kalanaraspa.com",
  role: "STAFF" as const,
};

type Tables = Record<string, unknown>;

function builder(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

function mockClient(tables: Tables, rpc = vi.fn()) {
  const from = vi.fn((table: string) => builder(tables[table] ?? { data: null, error: null }));
  getAdminClientMock.mockReturnValue({ from, rpc });
  return { from, rpc };
}

const order = {
  id: ORDER_ID,
  payment_status: "COMPLETED",
  customer_name: "Tri",
  customer_email: "buyer@gmail.com",
  customer_phone: "+62 896 0000 0000",
  voucher_id: VOUCHER_ID,
  send_to: null,
  recipient_phone: null,
};

const voucher = {
  id: VOUCHER_ID,
  code: "KSP-2026-TEST0001",
  recipient_name: "Dias",
  recipient_email: "dias@gmail.com",
  sender_name: "Tri",
  sender_message: null,
  amount: 550000,
  expiry_date: "2099-01-01T00:00:00.000Z",
  is_redeemed: false,
  services: { name: "Love Birds 1", duration: 210 },
};

const item = {
  id: ITEM_ID,
  voucher_id: VOUCHER_ID,
  send_to: "RECIPIENT",
  recipient_phone: "+62 812 1111 2222",
  sort_order: 0,
};

function baseTables(overrides: Tables = {}): Tables {
  return {
    orders: { data: order, error: null },
    order_items: { data: [item], error: null },
    vouchers: { data: voucher, error: null },
    voucher_delivery_outbox: { data: [], error: null },
    voucher_delivery_resends: { data: [], error: null },
    ...overrides,
  };
}

function rpcFor(begin: unknown, finish: unknown = { status: "ok", recipient_email_updated: false }) {
  return vi.fn(async (name: string) =>
    name === "voucher_resend_begin"
      ? { data: begin, error: null }
      : { data: finish, error: null }
  );
}

describe("voucher resend actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(access);
    sendVoucherEmailMessageMock.mockResolvedValue({ ok: true, messageId: "email-1" });
    renderVoucherEmailHtmlMock.mockImplementation((_content: unknown, options?: { variant?: string }) =>
      options?.variant === "buyer_copy" ? "<html>copy</html>" : "<html>voucher</html>"
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://voucher.kalanaraspa.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("refuses when the admin lacks the resend permission", async () => {
    requireAdminPermissionMock.mockRejectedValue(new Error("Forbidden"));
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).rejects.toThrow("Forbidden");
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.ORDERS_RESEND_VOUCHER);
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("accepts seeded non-RFC ids and sends with a key unique to the audit row", async () => {
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));

    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });

    expect(result).toEqual({ status: "sent", to: "dias@gmail.com", recipientEmailUpdated: false });
    expect(sendVoucherEmailMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "dias@gmail.com",
        idempotencyKey: `voucher-resend-${RESEND_ID}`,
      })
    );
    // Audit row first, then the send, then the finish.
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "voucher_resend_begin",
      "voucher_resend_finish",
    ]);
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_begin",
      expect.objectContaining({
        p_channel: "EMAIL",
        p_target_kind: "RECIPIENT",
        p_target_email: "dias@gmail.com",
        p_requested_by: access.userId,
        p_requested_by_email: access.email,
        p_requested_by_role: "STAFF",
      })
    );
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_finish",
      expect.objectContaining({ p_resend_id: RESEND_ID, p_sent: true, p_provider_message_id: "email-1" })
    );
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      access,
      expect.objectContaining({ action: "orders.voucher_resend", target: VOUCHER_ID })
    );
  });

  test("sends to the buyer email when the buyer is chosen", async () => {
    mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "BUYER",
    });
    expect(result).toMatchObject({ status: "sent", to: "buyer@gmail.com" });
    // The voucher is for Dias, so the buyer gets the buyer copy, not the gift email.
    expect(sendVoucherEmailMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "buyer copy subject", html: "<html>copy</html>" })
    );
  });

  test("rejects a typo custom address before touching the database", async () => {
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "CUSTOM",
      email: "dias@gmail",
    });
    expect(result).toEqual({ status: "invalid_email" });
    expect(rpc).not.toHaveBeenCalled();
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("passes save-as-recipient only for a custom address and reports the update", async () => {
    const { rpc } = mockClient(
      baseTables(),
      rpcFor({ status: "ok", resend_id: RESEND_ID }, { status: "ok", recipient_email_updated: true })
    );
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "CUSTOM",
      email: "  dias.benar@gmail.com ",
      saveAsRecipient: true,
    });
    expect(result).toEqual({ status: "sent", to: "dias.benar@gmail.com", recipientEmailUpdated: true });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_begin",
      expect.objectContaining({ p_target_kind: "CUSTOM", p_save_as_recipient: true })
    );
  });

  test.each([
    ["redeemed", "redeemed"],
    ["expired", "expired"],
    ["not_paid", "not_paid"],
    ["not_found", "not_found"],
  ])("returns %s from the database without sending", async (dbStatus, expected) => {
    mockClient(baseTables(), rpcFor({ status: dbStatus }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result.status).toBe(expected);
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("passes the wait time on a rate limit", async () => {
    mockClient(baseTables(), rpcFor({ status: "rate_limited", retry_after_seconds: 1800 }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 1800 });
  });

  test("marks the row FAILED and returns provider_error when Resend rejects", async () => {
    sendVoucherEmailMessageMock.mockResolvedValue({ ok: false, reason: "provider", message: "invalid to" });
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "provider_error" });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_finish",
      expect.objectContaining({ p_sent: false, p_error: "provider: invalid to" })
    );
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      access,
      expect.objectContaining({ action: "orders.voucher_resend_failed" })
    );
  });

  test("a render bug is a logged server error, not a provider rejection", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderVoucherEmailHtmlMock.mockImplementation(() => {
      throw new Error("template blew up");
    });
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "error" });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_finish",
      expect.objectContaining({ p_sent: false, p_error: "internal: template blew up" })
    );
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Voucher resend failed before sending.", expect.any(Error));
  });

  test("an unexpected throw from the send helper is a server error too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendVoucherEmailMessageMock.mockRejectedValue(new Error("setup broke"));
    mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "error" });
  });

  test("says the email went out when only the audit finish fails", async () => {
    mockClient(
      baseTables(),
      vi.fn(async (name: string) =>
        name === "voucher_resend_begin"
          ? { data: { status: "ok", resend_id: RESEND_ID }, error: null }
          : { data: null, error: { message: "timeout" } }
      )
    );
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "sent_not_logged", to: "dias@gmail.com" });
  });

  test("returns no_address when the voucher has no recipient email", async () => {
    mockClient(
      baseTables({ vouchers: { data: { ...voucher, recipient_email: null }, error: null } }),
      rpcFor({ status: "ok", resend_id: RESEND_ID })
    );
    const result = await resendVoucherEmail({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "no_address" });
  });

  test("overview shows a voucher that was never emailed (WhatsApp-only order)", async () => {
    mockClient(
      baseTables({
        vouchers: { data: [voucher], error: null },
        voucher_delivery_outbox: { data: [], error: null },
      })
    );
    const result = await getVoucherDeliveryOverview(ORDER_ID);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.vouchers).toHaveLength(1);
    expect(result.vouchers[0]).toMatchObject({
      voucherId: VOUCHER_ID,
      orderItemId: ITEM_ID,
      email: { state: "NONE", at: null },
      lastResend: null,
      whatsAppTarget: { kind: "RECIPIENT", phone: "+62 812 1111 2222" },
      buyerEmail: "buyer@gmail.com",
    });
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.ORDERS_VIEW);
  });

  test("overview reports the order email and the last resend", async () => {
    mockClient(
      baseTables({
        vouchers: { data: [voucher], error: null },
        voucher_delivery_outbox: {
          data: [
            {
              voucher_id: VOUCHER_ID,
              channel: "EMAIL",
              status: "SENT",
              sent_at: "2026-11-27T09:51:41.000Z",
              updated_at: "2026-11-27T09:51:41.000Z",
            },
          ],
          error: null,
        },
        voucher_delivery_resends: {
          data: [
            {
              voucher_id: VOUCHER_ID,
              status: "SENT",
              target_email: "buyer@gmail.com",
              created_at: "2026-11-27T13:00:00.000Z",
              finished_at: "2026-11-27T13:00:02.000Z",
              requested_by_email: "kasir@kalanaraspa.com",
            },
          ],
          error: null,
        },
      })
    );
    const result = await getVoucherDeliveryOverview(ORDER_ID);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.vouchers[0].email).toEqual({ state: "SENT", at: "2026-11-27T09:51:41.000Z" });
    expect(result.vouchers[0].lastResend).toEqual({
      status: "SENT",
      to: "buyer@gmail.com",
      at: "2026-11-27T13:00:02.000Z",
      by: "kasir@kalanaraspa.com",
    });
  });

  test("building the WhatsApp link sends nothing and logs nothing", async () => {
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await getVoucherWhatsAppLink({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.url.startsWith("https://wa.me/6281211112222?text=")).toBe(true);
    expect(decodeURIComponent(result.url)).toContain("https://voucher.kalanaraspa.com/verify?code=KSP-2026-TEST0001");
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("the WhatsApp link needs NEXT_PUBLIC_APP_URL instead of falling back to production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    mockClient(baseTables());
    await expect(
      getVoucherWhatsAppLink({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).rejects.toThrow("NEXT_PUBLIC_APP_URL");
  });

  test("the WhatsApp link refuses a redeemed voucher or one from another order", async () => {
    mockClient(baseTables({ vouchers: { data: { ...voucher, is_redeemed: true }, error: null } }));
    await expect(
      getVoucherWhatsAppLink({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "redeemed" });

    mockClient(
      baseTables({
        orders: { data: { ...order, voucher_id: null }, error: null },
        order_items: { data: [], error: null },
      })
    );
    await expect(
      getVoucherWhatsAppLink({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "not_found" });
  });

  test("a copied WhatsApp link is logged as COPIED with the normalized phone", async () => {
    const { rpc } = mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const result = await recordVoucherWhatsAppLinkCopied({
      orderId: ORDER_ID,
      voucherId: VOUCHER_ID,
      target: "RECIPIENT",
    });
    expect(result).toEqual({ status: "ok" });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_begin",
      expect.objectContaining({ p_channel: "WHATSAPP_LINK", p_target_phone: "6281211112222" })
    );
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      access,
      expect.objectContaining({ action: "orders.voucher_whatsapp_link", target: VOUCHER_ID })
    );
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("refuses a voucher that does not belong to the order", async () => {
    // The order links neither through order_items nor orders.voucher_id; the
    // begin RPC owns that check (see the migration contract test) and says
    // not_found for exactly this pair.
    const rpc = rpcFor({ status: "not_found" });
    mockClient(
      baseTables({
        orders: { data: { ...order, voucher_id: null }, error: null },
        order_items: { data: [], error: null },
      }),
      rpc
    );
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "not_found", retryAfterSeconds: null });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_begin",
      expect.objectContaining({ p_order_id: ORDER_ID, p_voucher_id: VOUCHER_ID })
    );
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("returns pdf_error and marks the row FAILED when the PDF cannot be made", async () => {
    const rpc = rpcFor({ status: "ok", resend_id: RESEND_ID });
    mockClient(baseTables(), rpc);
    sendVoucherEmailMessageMock.mockResolvedValue({ ok: false, reason: "pdf", message: "Failed to generate voucher PDF" });
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "pdf_error" });
    expect(rpc).toHaveBeenCalledWith(
      "voucher_resend_finish",
      expect.objectContaining({ p_resend_id: RESEND_ID, p_sent: false })
    );
  });

  test("returns network when the email provider cannot be reached", async () => {
    mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    sendVoucherEmailMessageMock.mockResolvedValue({ ok: false, reason: "network", message: "Email provider unreachable" });
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).resolves.toEqual({ status: "network" });
  });

  test("throws the database error when the begin RPC fails, before any send", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "function does not exist" } }));
    mockClient(baseTables(), rpc);
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" })
    ).rejects.toEqual({ message: "function does not exist" });
    expect(sendVoucherEmailMessageMock).not.toHaveBeenCalled();
  });

  test("a request id becomes the provider idempotency key", async () => {
    mockClient(baseTables(), rpcFor({ status: "ok", resend_id: RESEND_ID }));
    const requestId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT", requestId });
    expect(sendVoucherEmailMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `voucher-resend-${requestId}` })
    );
    await expect(
      resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT", requestId: "nope" })
    ).resolves.toEqual({ status: "invalid" });
  });

  test("sends to the trimmed stored address", async () => {
    mockClient(
      baseTables({ vouchers: { data: { ...voucher, recipient_email: "  dias@gmail.com " }, error: null } }),
      rpcFor({ status: "ok", resend_id: RESEND_ID })
    );
    await resendVoucherEmail({ orderId: ORDER_ID, voucherId: VOUCHER_ID, target: "RECIPIENT" });
    expect(sendVoucherEmailMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dias@gmail.com" })
    );
  });
});

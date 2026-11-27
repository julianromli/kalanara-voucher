import { beforeEach, describe, expect, test, vi } from "vitest";

const { resendMock } = vi.hoisted(() => ({ resendMock: vi.fn() }));

vi.mock("@/lib/voucher-resend/server", () => ({
  resendVoucherEmailForAdmin: resendMock,
}));

vi.mock("@/lib/auth/admin-rbac-server", () => {
  class AdminPermissionError extends Error {
    status: 401 | 403;
    constructor(message: string, status: 401 | 403) {
      super(message);
      this.status = status;
    }
  }
  return {
    AdminPermissionError,
    isAdminPermissionError: (error: unknown) => error instanceof AdminPermissionError,
  };
});

import { AdminPermissionError } from "@/lib/auth/admin-rbac-server";
import { POST } from "@/app/api/admin/vouchers/resend/route";

function request(body: string) {
  return new Request("http://localhost/api/admin/vouchers/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }) as never;
}

describe("POST /api/admin/vouchers/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("passes the input to the resend and returns its result", async () => {
    resendMock.mockResolvedValue({ status: "sent", to: "dias@gmail.com", recipientEmailUpdated: false });
    const response = await POST(
      request(
        JSON.stringify({
          orderId: "o",
          voucherId: "v",
          target: "CUSTOM",
          email: "dias@gmail.com",
          saveAsRecipient: true,
        })
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "sent",
      to: "dias@gmail.com",
      recipientEmailUpdated: false,
    });
    expect(resendMock).toHaveBeenCalledWith({
      orderId: "o",
      voucherId: "v",
      target: "CUSTOM",
      email: "dias@gmail.com",
      saveAsRecipient: true,
    });
  });

  test("returns 400 invalid for malformed JSON", async () => {
    const response = await POST(request("{bad"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ status: "invalid" });
    expect(resendMock).not.toHaveBeenCalled();
  });

  test("rejects a non-JSON content type", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/vouchers/resend", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }) as never
    );
    expect(response.status).toBe(415);
    expect(resendMock).not.toHaveBeenCalled();
  });

  test("returns forbidden with the permission status", async () => {
    resendMock.mockRejectedValue(new AdminPermissionError("Unauthorized", 401));
    const response = await POST(request("{}"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ status: "forbidden" });
  });
});

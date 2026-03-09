import { describe, expect, test, vi } from "vitest";

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: vi.fn(),
    };
  },
}));

describe("POST /api/email/send-voucher", () => {
  test("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/email/send-voucher/route");

    const response = await POST(
      new Request("http://localhost/api/email/send-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid",
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON in request body",
    });
  });
});

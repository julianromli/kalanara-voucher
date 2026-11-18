import { beforeEach, describe, expect, test, vi } from "vitest";

const { requireAdminPermissionMock, logAdminAuditMock, getAdminClientMock, headerState } =
  vi.hoisted(() => ({
    requireAdminPermissionMock: vi.fn(),
    logAdminAuditMock: vi.fn(),
    getAdminClientMock: vi.fn(),
    headerState: { ip: "203.0.113.20" },
  }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": headerState.ip }),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
  logAdminAudit: logAdminAuditMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

import { addStamp, claimReward, selfSignup, voidStamp } from "@/lib/actions/members";

const access = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "kasir@kalanaraspa.com",
  role: "STAFF" as const,
};

function mockClient(rpc: ReturnType<typeof vi.fn>, from = vi.fn()) {
  getAdminClientMock.mockReturnValue({ rpc, from });
}

describe("member actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerState.ip = "203.0.113.20";
    requireAdminPermissionMock.mockResolvedValue(access);
    process.env.NEXT_PUBLIC_APP_URL = "https://voucher.kalanaraspa.com";
  });

  test("returns capped when the stamp count is already 30", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "capped", count: 30, reset_on: "2027-06-01" },
      error: null,
    });
    mockClient(rpc);

    const result = await addStamp({
      memberId: "22222222-2222-4222-8222-222222222222",
      serviceId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.status).toBe("capped");
    if (result.status !== "capped") return;
    expect(result.resetOn).toBe("2027-06-01");
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("returns needs_confirm for a second stamp on the same day", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "needs_confirm",
        service_name: "Body Massage 60 menit",
        created_at: "2026-11-18T03:12:00.000Z",
      },
      error: null,
    });
    mockClient(rpc);

    const result = await addStamp({
      memberId: "22222222-2222-4222-8222-222222222222",
      serviceId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.status).toBe("needs_confirm");
    if (result.status !== "needs_confirm") return;
    expect(result.serviceName).toBe("Body Massage 60 menit");
  });

  test("rejects a void after the server window", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "too_late" },
      error: null,
    });
    mockClient(rpc);

    const result = await voidStamp({
      stampId: "44444444-4444-4444-8444-444444444444",
    });

    expect(result.status).toBe("too_late");
  });

  test("returns already_claimed for a second claim", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "already_claimed" },
      error: null,
    });
    mockClient(rpc);

    const result = await claimReward({
      memberId: "22222222-2222-4222-8222-222222222222",
      milestone: 10,
      serviceName: "Body Massage 60 menit",
    });

    expect(result.status).toBe("already_claimed");
  });

  test("hides the card link when the phone is already registered", async () => {
    headerState.ip = "203.0.113.21";
    const from = vi.fn((table: string) => {
      if (table === "member_signup_qr") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: { id: "qr-1" }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "member-1" }, error: null }),
          }),
        }),
      };
    });
    mockClient(vi.fn(), from);

    const result = await selfSignup({
      qrToken: "ab".repeat(16),
      name: "Rina",
      phone: "081234564471",
      birthDate: "1994-08-14",
      waConsent: true,
      website: "",
    });

    expect(result).toEqual({ status: "duplicate" });
    expect(JSON.stringify(result)).not.toContain("member-1");
    expect(JSON.stringify(result)).not.toContain("/m/");
  });

  test("returns a success shape with no link when the honeypot is filled", async () => {
    headerState.ip = "203.0.113.22";
    mockClient(vi.fn(), vi.fn());

    const result = await selfSignup({
      qrToken: "cd".repeat(16),
      name: "Bot",
      phone: "081200000001",
      birthDate: "1990-01-01",
      waConsent: false,
      website: "https://spam.example",
    });

    expect(result).toEqual({ status: "ok" });
    expect(getAdminClientMock).not.toHaveBeenCalled();
  });
});

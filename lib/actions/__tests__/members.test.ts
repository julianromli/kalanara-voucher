import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

import { addStamp, claimReward, listMemberProfileAudit, listMembers, markFollowupSent, saveRewards, searchMembers, selfSignup, updateMember, voidStamp } from "@/lib/actions/members";
import { AdminPermission } from "@/lib/auth/admin-rbac";

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
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://voucher.kalanaraspa.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
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
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
    expect(rpc).toHaveBeenCalledWith(
      "member_add_stamp",
      expect.objectContaining({ p_confirm_same_day: false }),
    );

    rpc.mockResolvedValue({
      data: { status: "ok", stamp_id: "55555555-5555-4555-8555-555555555555", count: 2 },
      error: null,
    });
    const confirmed = await addStamp({
      memberId: "22222222-2222-4222-8222-222222222222",
      serviceId: "33333333-3333-4333-8333-333333333333",
      confirmSameDay: true,
    });
    expect(confirmed.status).toBe("ok");
    expect(rpc).toHaveBeenLastCalledWith(
      "member_add_stamp",
      expect.objectContaining({ p_confirm_same_day: true }),
    );
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
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
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
      expectedName: "Treatment gratis",
    });

    expect(result.status).toBe("already_claimed");
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
    expect(rpc).toHaveBeenCalledWith(
      "member_claim_reward",
      expect.objectContaining({ p_expected_name: "Treatment gratis" }),
    );
  });

  test("hides the card link when the phone is already registered", async () => {
    headerState.ip = "203.0.113.21";
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "duplicate" },
      error: null,
    });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => ({ data: { id: "qr-1" }, error: null }),
          }),
        }),
      }),
    }));
    mockClient(rpc, from);

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

  test("reports a 15 minute wait when the same IP signs up too often", async () => {
    headerState.ip = "203.0.113.61";
    const rpc = vi.fn().mockResolvedValue({ data: { status: "retry" }, error: null });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => ({ data: { id: "qr-1" }, error: null }),
          }),
        }),
      }),
    }));
    mockClient(rpc, from);

    let result: Awaited<ReturnType<typeof selfSignup>> = { status: "invalid" };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      result = await selfSignup({
        qrToken: "ab".repeat(16),
        name: "Rina",
        phone: `08121000000${attempt}`,
        birthDate: "1994-08-14",
        waConsent: false,
        website: "",
      });
    }

    expect(result).toEqual({ status: "rate_limited", retryAfterMinutes: 15 });
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  test("reports a one hour wait when the same phone signs up too often", async () => {
    headerState.ip = "203.0.113.62";
    const rpc = vi.fn().mockResolvedValue({ data: { status: "retry" }, error: null });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => ({ data: { id: "qr-1" }, error: null }),
          }),
        }),
      }),
    }));
    mockClient(rpc, from);
    const input = {
      qrToken: "ef".repeat(16),
      name: "Rina",
      phone: "081299900001",
      birthDate: "1994-08-14",
      waConsent: false,
      website: "",
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await selfSignup(input);
    }

    await expect(selfSignup(input)).resolves.toEqual({
      status: "rate_limited",
      retryAfterMinutes: 60,
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  test("returns reward_changed when the cashier expected a different reward", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: "reward_changed", reward_name: "Totok wajah" },
      error: null,
    });
    mockClient(rpc);

    const result = await claimReward({
      memberId: "22222222-2222-4222-8222-222222222222",
      milestone: 5,
      serviceName: "Body Massage 60 menit",
      expectedName: "Totok gratis",
    });

    expect(result).toEqual({
      status: "reward_changed",
      claimId: null,
      rewardName: "Totok wajah",
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("returns the latest reward rows when a save hits a stale updated_at", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "member_save_rewards") {
        return Promise.resolve({
          data: { status: "conflict", milestone: 5 },
          error: null,
        });
      }
      return Promise.resolve({
        data: [{ milestone: 5, reached_count: 2 }],
        error: null,
      });
    });
    const from = vi.fn(() => ({
      select: () => ({
        order: async () => ({
          data: [
            {
              milestone: 5,
              name: "Totok wajah",
              note: "",
              updated_at: "2026-11-18T12:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    }));
    mockClient(rpc, from);
    requireAdminPermissionMock.mockResolvedValue({ ...access, role: "ADMIN" as const });

    const result = await saveRewards({
      rows: [
        {
          milestone: 5,
          name: "Totok gratis",
          note: "",
          updatedAt: "2026-11-18T11:00:00.000Z",
        },
      ],
    });

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;
    expect(result.milestone).toBe(5);
    expect(result.rows).toEqual([
      {
        milestone: 5,
        name: "Totok wajah",
        note: "",
        updatedAt: "2026-11-18T12:00:00.000Z",
        reachedCount: 2,
      },
    ]);
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("checks one follow-up with member_followup_is_due", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const from = vi.fn(() => ({
      insert: async () => ({ error: null }),
    }));
    mockClient(rpc, from);

    const result = await markFollowupSent({
      memberId: "22222222-2222-4222-8222-222222222222",
      stage: "day30",
      anchorDate: "2026-10-19",
    });

    expect(result.status).toBe("ok");
    expect(rpc).toHaveBeenCalledWith(
      "member_followup_is_due",
      expect.objectContaining({
        p_member_id: "22222222-2222-4222-8222-222222222222",
        p_stage: "day30",
        p_anchor_date: "2026-10-19",
      }),
    );
    expect(rpc).not.toHaveBeenCalledWith("list_member_followups");
  });
});

describe("searchMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(access);
  });

  function mockSearch({
    data = [],
    error = null,
  }: {
    data?: Array<{ id: string; name: string; phone: string; member_code: string }>;
    error?: unknown;
  } = {}) {
    const eq = vi.fn().mockResolvedValue({ data, error });
    const ilike = vi.fn().mockResolvedValue({ data, error });
    const from = vi.fn(() => ({
      select: () => ({
        limit: () => ({ eq, ilike }),
      }),
    }));
    mockClient(vi.fn(), from);
    return { eq, ilike, from };
  }

  test("finds dinda with a case-insensitive name search", async () => {
    const { eq, ilike } = mockSearch({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Dinda Salsabilla",
          phone: "6282212347221",
          member_code: "7KQ2X9",
        },
      ],
    });

    const result = await searchMembers({ q: "dinda" });

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
    expect(ilike).toHaveBeenCalledWith("name", "%dinda%");
    expect(eq).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "ok",
      members: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Dinda Salsabilla",
          phone: "6282212347221",
          memberCode: "7KQ2X9",
        },
      ],
    });
  });

  test("looks up a phone number exactly", async () => {
    const { eq, ilike } = mockSearch({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Rina Maharani",
          phone: "6281234567890",
          member_code: "7KQ2X9",
        },
      ],
    });

    const result = await searchMembers({ q: "0812 3456 7890" });

    expect(eq).toHaveBeenCalledWith("phone", "6281234567890");
    expect(ilike).not.toHaveBeenCalled();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.members).toHaveLength(1);
    expect(result.members[0]?.phone).toBe("6281234567890");
  });

  test("returns no rows for a one-letter query without hitting the database", async () => {
    const { from } = mockSearch();
    const result = await searchMembers({ q: "d" });
    expect(result).toEqual({ status: "ok", members: [] });
    expect(from).not.toHaveBeenCalled();
  });

  test("strips like wildcards from a name query", async () => {
    const { ilike } = mockSearch();
    await searchMembers({ q: "din%da_x" });
    expect(ilike).toHaveBeenCalledWith("name", "%dindax%");
  });
});

describe("listMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(access);
  });

  function mockListTables(tables: Record<string, { data: unknown; error: unknown }>) {
    const ranges: Record<string, Array<[number, number]>> = {};
    const from = vi.fn((name: string) => {
      const result = tables[name] ?? { data: [], error: null };
      if (name === "member_rewards") {
        return {
          select: () => ({
            order: async () => result,
          }),
        };
      }
      const rows = Array.isArray(result.data) ? result.data : [];
      return {
        select: () => ({
          order: () => ({
            range: (start: number, end: number) => {
              ranges[name] = ranges[name] ?? [];
              ranges[name].push([start, end]);
              if (result.error) return Promise.resolve({ data: null, error: result.error });
              return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
            },
          }),
        }),
      };
    });
    mockClient(vi.fn(), from);
    return { from, ranges };
  }

  test("requires MEMBERS_OPERATE and flags a member one stamp short of a named reward", async () => {
    mockListTables({
      members: {
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dinda Salsabilla",
            phone: "6282212347221",
            created_at: "2026-01-10T03:00:00Z",
            base_tier: 0,
            cycle_start: "2026-01-10",
          },
        ],
        error: null,
      },
      member_stamps: {
        data: Array.from({ length: 9 }, (_, index) => ({
          member_id: "22222222-2222-4222-8222-222222222222",
          cycle_start: "2026-01-10",
          visit_date: `2026-0${Math.min(index + 2, 9)}-01`,
          created_at: `2026-0${Math.min(index + 2, 9)}-01T04:00:00Z`,
          voided_at: null,
        })),
        error: null,
      },
      member_rewards: {
        data: [
          { milestone: 5, name: "" },
          { milestone: 10, name: "Treatment gratis" },
        ],
        error: null,
      },
    });

    const result = await listMembers();

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_OPERATE);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.milestones).toEqual([10]);
    expect(result.followUp.nearReward).toHaveLength(1);
    expect(result.followUp.nearReward[0]?.stampCount).toBe(9);
    expect(result.followUp.nearReward[0]?.nextRewardName).toBe("Treatment gratis");
    expect(result.page.totalCount).toBe(1);
    expect(result.page.rows[0]?.phone).toBe("6282212347221");
  });

  test("searches by name and ignores voided stamps", async () => {
    mockListTables({
      members: {
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dinda Salsabilla",
            phone: "6282212347221",
            created_at: "2026-01-10T03:00:00Z",
            base_tier: 0,
            cycle_start: "2026-01-10",
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Rina Maharani",
            phone: "6281234564471",
            created_at: "2026-01-11T03:00:00Z",
            base_tier: 0,
            cycle_start: "2026-01-11",
          },
        ],
        error: null,
      },
      member_stamps: {
        data: [
          {
            member_id: "22222222-2222-4222-8222-222222222222",
            cycle_start: "2026-01-10",
            visit_date: "2026-02-01",
            created_at: "2026-02-01T04:00:00Z",
            voided_at: "2026-02-01T04:05:00Z",
          },
        ],
        error: null,
      },
      member_rewards: { data: [], error: null },
    });

    const result = await listMembers({ query: "dinda" });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.page.rows).toHaveLength(1);
    expect(result.page.rows[0]?.name).toBe("Dinda Salsabilla");
    expect(result.page.rows[0]?.stampCount).toBe(0);
  });

  test("pages past the Supabase 1000-row cap and keeps directory paging at 25", async () => {
    const memberRows = Array.from({ length: 1001 }, (_, index) => ({
      id: `member-${String(index).padStart(4, "0")}`,
      name: index === 1000 ? "Zahra Unique" : `Member ${String(index).padStart(4, "0")}`,
      phone: `62812${String(index).padStart(7, "0")}`,
      created_at: new Date(Date.UTC(2026, 0, 1, 3, 0, 0) + index * 1000).toISOString(),
      base_tier: 0,
      cycle_start: "2026-01-01",
    }));
    const { ranges } = mockListTables({
      members: { data: memberRows, error: null },
      member_stamps: {
        data: [
          ...Array.from({ length: 992 }, (_, index) => ({
            id: `stamp-void-${String(index).padStart(4, "0")}`,
            member_id: "member-1000",
            cycle_start: "2026-01-01",
            visit_date: "2026-02-01",
            created_at: "2026-02-01T04:00:00Z",
            voided_at: "2026-02-01T04:05:00Z",
          })),
          ...Array.from({ length: 9 }, (_, index) => ({
            id: `stamp-${index}`,
            member_id: "member-1000",
            cycle_start: "2026-01-01",
            visit_date: `2026-0${Math.min(index + 2, 9)}-01`,
            created_at: `2026-0${Math.min(index + 2, 9)}-01T04:00:00Z`,
            voided_at: null,
          })),
        ],
        error: null,
      },
      member_rewards: {
        data: [{ milestone: 10, name: "Treatment gratis" }],
        error: null,
      },
    });

    const first = await listMembers({ page: 1 });
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expect(ranges.members).toEqual([
      [0, 999],
      [1000, 1999],
      [1001, 2000],
    ]);
    expect(ranges.member_stamps).toEqual([
      [0, 999],
      [1000, 1999],
      [1001, 2000],
    ]);
    expect(first.page.totalCount).toBe(1001);
    expect(first.page.totalPages).toBe(41);
    expect(first.page.pageSize).toBe(25);
    expect(first.page.rows).toHaveLength(25);
    expect(first.page.rows[0]?.name).toBe("Zahra Unique");
    expect(first.followUp.nearReward.map((row) => row.name)).toContain("Zahra Unique");

    const last = await listMembers({ page: 99 });
    expect(last.status).toBe("ok");
    if (last.status !== "ok") return;
    expect(last.page.page).toBe(41);
    expect(last.page.rows).toHaveLength(1);
    expect(last.page.rows[0]?.name).toBe("Member 0000");

    const search = await listMembers({ query: "Zahra Unique" });
    expect(search.status).toBe("ok");
    if (search.status !== "ok") return;
    expect(search.page.totalCount).toBe(1);
    expect(search.page.rows[0]?.name).toBe("Zahra Unique");
    expect(search.page.rows[0]?.stampCount).toBe(9);
  });

  test("fails when a later members page errors", async () => {
    const from = vi.fn((name: string) => {
      if (name === "member_rewards") {
        return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      }
      if (name === "member_stamps") {
        return {
          select: () => ({
            order: () => ({
              range: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () => ({
            range: async (start: number) => {
              if (start === 0) {
                return {
                  data: Array.from({ length: 1000 }, (_, index) => ({
                    id: `member-${index}`,
                    name: `Member ${index}`,
                    phone: `62812${String(index).padStart(7, "0")}`,
                    created_at: "2026-01-01T03:00:00Z",
                    base_tier: 0,
                    cycle_start: "2026-01-01",
                  })),
                  error: null,
                };
              }
              return { data: null, error: { message: "timeout" } };
            },
          }),
        }),
      };
    });
    mockClient(vi.fn(), from);
    const result = await listMembers();
    expect(result).toEqual({ status: "error" });
  });
});


const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

const managerAccess = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "manager@kalanaraspa.com",
  role: "MANAGER" as const,
};

function summaryRpc(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    member: {
      id: MEMBER_ID,
      name: "Rina Maharani",
      phone: "6281234564471",
      birth_date: "1994-03-12",
      wa_consent: true,
      member_code: "7KQ2X9",
      card_token: "a".repeat(48),
      created_at: "2026-03-12T03:00:00Z",
      source: "cashier",
    },
    stamp_count: 4,
    reset_on: "2027-03-12",
    cycle_start: "2026-03-12",
    base_tier: 0,
    effective_tier: 0,
    rolled_cycles: 0,
    birthday: {
      eligible: false,
      redeemed: false,
      occurrence: "2027-03-12",
      window_start: "2027-03-09",
      window_end: "2027-03-15",
      birthday_year: 2027,
    },
    last_treatment: null,
    rewards: [],
    stamps: [],
    claims: [],
    birthday_redemptions: [],
    ...overrides,
  };
}

describe("updateMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(managerAccess);
  });

  function mockProfile({
    write = { data: { status: "ok", fields: ["name"] }, error: null } as {
      data: { status: string; fields?: string[] } | null;
      error: { message?: string } | null;
    },
    summary = summaryRpc(),
  } = {}) {
    const rpc = vi.fn(async (name: string) => {
      if (name === "member_update_profile") return write;
      if (name === "get_member_summary") return { data: summary, error: null };
      throw new Error(`unexpected rpc ${name}`);
    });
    mockClient(rpc, vi.fn());
    return { rpc };
  }

  test("requires MEMBERS_SETTINGS and does not write when access is denied", async () => {
    const mocks = mockProfile();
    requireAdminPermissionMock.mockRejectedValueOnce(new Error("Forbidden"));

    await expect(
      updateMember({
        memberId: MEMBER_ID,
        name: "Rina",
        phone: "6281234564471",
        birthDate: "1994-03-12",
        waConsent: true,
      }),
    ).rejects.toThrow("Forbidden");

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_SETTINGS);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("rejects an invalid name, phone, or birth date", async () => {
    const mocks = mockProfile();
    const base = {
      memberId: MEMBER_ID,
      name: "Rina Maharani",
      phone: "6281234564471",
      birthDate: "1994-03-12",
      waConsent: true,
    };

    expect(await updateMember({ ...base, name: "" })).toEqual({ status: "invalid" });
    expect(await updateMember({ ...base, name: "R".repeat(41) })).toEqual({ status: "invalid" });
    expect(await updateMember({ ...base, phone: "123" })).toEqual({ status: "invalid" });
    expect(await updateMember({ ...base, birthDate: "1994-13-40" })).toEqual({ status: "invalid" });
    expect(await updateMember({ ...base, birthDate: "2099-01-01" })).toEqual({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("returns a friendly message when the new phone is already used", async () => {
    mockProfile({ write: { data: { status: "duplicate" }, error: null } });
    const result = await updateMember({
      memberId: MEMBER_ID,
      name: "Rina Maharani",
      phone: "0812 3456 9999",
      birthDate: "1994-03-12",
      waConsent: true,
    });
    expect(result).toEqual({
      status: "duplicate",
      message: "Nomor ini sudah dipakai member lain",
    });
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("writes the profile and audit rows in one RPC and leaves stamps and cycle alone", async () => {
    const mocks = mockProfile({
      write: {
        data: { status: "ok", fields: ["name", "phone", "birth_date", "wa_consent"] },
        error: null,
      },
      summary: summaryRpc({
        member: {
          id: MEMBER_ID,
          name: "Rina M",
          phone: "6282212347221",
          birth_date: "1995-04-20",
          wa_consent: false,
          member_code: "7KQ2X9",
          card_token: "a".repeat(48),
          created_at: "2026-03-12T03:00:00Z",
          source: "cashier",
        },
      }),
    });

    const result = await updateMember({
      memberId: MEMBER_ID,
      name: "Rina M",
      phone: "0822 1234 7221",
      birthDate: "1995-04-20",
      waConsent: false,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.summary.name).toBe("Rina M");
    expect(result.summary.phone).toBe("6282212347221");
    expect(result.summary.stampCount).toBe(4);
    expect(result.summary.cycleStart).toBe("2026-03-12");
    expect(result.summary.baseTier).toBe(0);

    expect(mocks.rpc).toHaveBeenCalledWith("member_update_profile", {
      p_member_id: MEMBER_ID,
      p_name: "Rina M",
      p_phone: "6282212347221",
      p_birth_date: "1995-04-20",
      p_wa_consent: false,
      p_changed_by: managerAccess.userId,
      p_changed_by_email: managerAccess.email,
      p_changed_by_role: "MANAGER",
    });
    expect(mocks.rpc.mock.calls.some((call) => call[0] === "members" || call[0] === "member_profile_audit")).toBe(false);
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      managerAccess,
      expect.objectContaining({
        action: "membership.member_update",
        target: MEMBER_ID,
        details: { fields: ["name", "phone", "birth_date", "wa_consent"] },
      }),
    );
  });

  test("returns an error and does not log when the profile write RPC fails", async () => {
    const mocks = mockProfile({
      write: { data: null, error: { message: "audit table unavailable" } },
    });
    const result = await updateMember({
      memberId: MEMBER_ID,
      name: "Rina M",
      phone: "6281234564471",
      birthDate: "1994-03-12",
      waConsent: true,
    });
    expect(result).toEqual({ status: "error" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "member_update_profile",
      expect.objectContaining({ p_member_id: MEMBER_ID, p_name: "Rina M" }),
    );
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });

  test("does not log an audit when the RPC reports no changes", async () => {
    const mocks = mockProfile({ write: { data: { status: "unchanged" }, error: null } });
    const result = await updateMember({
      memberId: MEMBER_ID,
      name: "  Rina Maharani  ",
      phone: "081234564471",
      birthDate: "1994-03-12",
      waConsent: true,
    });
    expect(result.status).toBe("ok");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "member_update_profile",
      expect.objectContaining({
        p_name: "Rina Maharani",
        p_phone: "6281234564471",
      }),
    );
    expect(logAdminAuditMock).not.toHaveBeenCalled();
  });
});

describe("listMemberProfileAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPermissionMock.mockResolvedValue(managerAccess);
  });

  test("requires MEMBERS_SETTINGS and returns mapped rows", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          field: "name",
          old_value: "Rina",
          new_value: "Rina M",
          changed_by_email: "manager@kalanaraspa.com",
          changed_by_role: "MANAGER",
          created_at: "2026-11-25T10:00:00Z",
        },
      ],
      error: null,
    });
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit }),
        }),
      }),
    }));
    mockClient(vi.fn(), from);

    const result = await listMemberProfileAudit(MEMBER_ID);
    expect(requireAdminPermissionMock).toHaveBeenCalledWith(AdminPermission.MEMBERS_SETTINGS);
    expect(result).toEqual({
      status: "ok",
      rows: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          field: "name",
          oldValue: "Rina",
          newValue: "Rina M",
          changedByEmail: "manager@kalanaraspa.com",
          changedByRole: "MANAGER",
          createdAt: "2026-11-25T10:00:00Z",
        },
      ],
    });
  });
});

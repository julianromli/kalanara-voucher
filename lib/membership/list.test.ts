import { describe, expect, test } from "vitest";
import { ADMIN_PAGE_SIZE } from "@/lib/actions/admin-pagination";
import {
  buildMemberListRow,
  configuredRewardMilestones,
  filterMemberList,
  isNearReward,
  paginateMemberList,
  pickFollowUpMembers,
  type MemberListRecord,
  type MemberListRow,
} from "@/lib/membership/list";

function record(overrides: Partial<MemberListRecord> = {}): MemberListRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Rina Maharani",
    phone: "6281234564471",
    createdAt: "2026-01-10T03:00:00Z",
    baseTier: 0,
    cycleStart: "2026-01-10",
    stamps: [],
    ...overrides,
  };
}

function row(overrides: Partial<MemberListRow> = {}): MemberListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Rina Maharani",
    phone: "6281234564471",
    effectiveTier: 0,
    stampCount: 0,
    lastVisitAt: null,
    createdAt: "2026-01-10T03:00:00Z",
    nextMilestone: 5,
    nextRewardName: "Totok gratis",
    ...overrides,
  };
}

describe("configuredRewardMilestones", () => {
  test("uses named rewards instead of hardcoding 5", () => {
    expect(
      configuredRewardMilestones([
        { milestone: 5, name: "" },
        { milestone: 10, name: "Treatment gratis" },
        { milestone: 15, name: "  " },
      ]),
    ).toEqual([10]);
  });

  test("falls back to the default ladder when no reward is named", () => {
    expect(configuredRewardMilestones([{ milestone: 5, name: "" }])).toEqual([
      5, 10, 15, 20, 25, 30,
    ]);
  });
});

describe("buildMemberListRow", () => {
  test("counts stamps in the current cycle and skips voided ones", () => {
    const built = buildMemberListRow(
      record({
        stamps: [
          { cycleStart: "2026-01-10", visitAt: "2026-02-01T04:00:00Z", voided: false },
          { cycleStart: "2026-01-10", visitAt: "2026-03-01T04:00:00Z", voided: true },
          { cycleStart: "2026-01-10", visitAt: "2026-04-01T04:00:00Z", voided: false },
        ],
      }),
      "2026-11-25",
      new Map([[5, "Totok gratis"]]),
    );
    expect(built.stampCount).toBe(2);
    expect(built.lastVisitAt).toBe("2026-04-01T04:00:00Z");
    expect(built.nextMilestone).toBe(5);
    expect(built.nextRewardName).toBe("Totok gratis");
  });

  test("rolls an expired cycle so the list matches the member card", () => {
    const built = buildMemberListRow(
      record({
        cycleStart: "2025-01-10",
        stamps: [
          { cycleStart: "2025-01-10", visitAt: "2025-06-01T04:00:00Z", voided: false },
          { cycleStart: "2025-01-10", visitAt: "2025-07-01T04:00:00Z", voided: false },
        ],
      }),
      "2026-11-25",
      new Map(),
    );
    expect(built.stampCount).toBe(0);
    expect(built.lastVisitAt).toBe("2025-07-01T04:00:00Z");
  });
});

describe("follow-up picks", () => {
  test("marks a member one stamp short of a configured reward", () => {
    const near = row({ stampCount: 9, nextMilestone: 10, nextRewardName: "Treatment gratis" });
    expect(isNearReward(near, [10])).toBe(true);
    expect(isNearReward(row({ stampCount: 4 }), [10])).toBe(false);
    expect(isNearReward(row({ stampCount: 4 }), [5, 10])).toBe(true);
  });

  test("lists near-reward members first and frequent visitors after, without overlap", () => {
    const near = row({
      id: "near",
      name: "Dinda",
      stampCount: 4,
      lastVisitAt: "2026-11-01T00:00:00Z",
    });
    const frequent = row({
      id: "freq",
      name: "Sari",
      stampCount: 8,
      lastVisitAt: "2026-11-20T00:00:00Z",
    });
    const groups = pickFollowUpMembers([near, frequent, row({ id: "zero", stampCount: 0 })], [5]);
    expect(groups.nearReward.map((item) => item.id)).toEqual(["near"]);
    expect(groups.frequent.map((item) => item.id)).toEqual(["freq"]);
  });
});

describe("filter and paginate", () => {
  const rows = [
    row({ id: "1", name: "Dinda Salsabilla", phone: "6282212347221", effectiveTier: 1, createdAt: "2026-02-01T00:00:00Z" }),
    row({ id: "2", name: "Rina Maharani", phone: "6281234564471", effectiveTier: 0, createdAt: "2026-01-01T00:00:00Z" }),
  ];

  test("finds dinda by name and by phone digits", () => {
    expect(filterMemberList(rows, { query: "dinda", tier: "all" }).map((item) => item.id)).toEqual(["1"]);
    expect(filterMemberList(rows, { query: "0822-1234-7221", tier: "all" }).map((item) => item.id)).toEqual(["1"]);
  });

  test("filters by level", () => {
    expect(filterMemberList(rows, { query: "", tier: "0" }).map((item) => item.id)).toEqual(["2"]);
    expect(filterMemberList(rows, { query: "", tier: "1" }).map((item) => item.id)).toEqual(["1"]);
  });

  test("paginates with the admin page size", () => {
    const many = Array.from({ length: 26 }, (_, index) =>
      row({
        id: String(index),
        name: `Member ${String(index).padStart(2, "0")}`,
        createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    const page = paginateMemberList(filterMemberList(many, { query: "", tier: "all" }), 2);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(ADMIN_PAGE_SIZE);
    expect(page.totalCount).toBe(26);
    expect(page.totalPages).toBe(2);
    expect(page.rows).toHaveLength(1);
  });
});

import { describe, expect, test } from "vitest";
import { attachMemberLinks, memberAdminPath } from "@/lib/admin/buyer-member-match";

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

describe("attachMemberLinks", () => {
  test("matches a buyer to a member by normalized phone and computes the current level", () => {
    const buyers = [
      { phone: "6281234564471", customerName: "Rina" },
      { phone: "6282212347221", customerName: "Budi" },
    ];
    const members = [
      {
        id: MEMBER_ID,
        phone: "6281234564471",
        memberCode: "7KQ2X9",
        cycleStart: "2026-01-10",
        baseTier: 0,
        stamps: Array.from({ length: 10 }, (_, index) => ({
          cycleStart: "2026-01-10",
          visitAt: `2026-02-${String(index + 1).padStart(2, "0")}T04:00:00Z`,
          voided: false,
        })),
      },
    ];

    const linked = attachMemberLinks(buyers, members, "2026-03-01");
    expect(linked[0]?.member).toEqual({
      id: MEMBER_ID,
      memberCode: "7KQ2X9",
      effectiveTier: 1,
    });
    expect(linked[1]?.member).toBeNull();
  });

  test("does not count a voided stamp toward the member level", () => {
    const linked = attachMemberLinks(
      [{ phone: "6281234564471", customerName: "Rina" }],
      [
        {
          id: MEMBER_ID,
          phone: "6281234564471",
          memberCode: "7KQ2X9",
          cycleStart: "2026-01-10",
          baseTier: 0,
          stamps: [
            ...Array.from({ length: 9 }, (_, index) => ({
              cycleStart: "2026-01-10",
              visitAt: `2026-02-${String(index + 1).padStart(2, "0")}T04:00:00Z`,
              voided: false,
            })),
            {
              cycleStart: "2026-01-10",
              visitAt: "2026-02-10T04:00:00Z",
              voided: true,
            },
          ],
        },
      ],
      "2026-03-01",
    );
    expect(linked[0]?.member?.effectiveTier).toBe(0);
  });

  test("uses the rolled cycle when the period has already reset", () => {
    const members = [
      {
        id: MEMBER_ID,
        phone: "6281234564471",
        memberCode: "7KQ2X9",
        cycleStart: "2025-01-10",
        baseTier: 0,
        stamps: Array.from({ length: 20 }, (_, index) => ({
          cycleStart: "2025-01-10",
          visitAt: `2025-03-${String((index % 28) + 1).padStart(2, "0")}T04:00:00Z`,
          voided: false,
        })),
      },
    ];
    const linked = attachMemberLinks(
      [{ phone: "6281234564471", customerName: "Rina" }],
      members,
      "2026-03-01",
    );
    // 20 stamps in the expired cycle carry Silver down one level to Bronze.
    expect(linked[0]?.member?.effectiveTier).toBe(1);
  });

  test("matches 08 buyer phones to stored 62 member phones", () => {
    const linked = attachMemberLinks(
      [{ phone: "081234564471", customerName: "Rina" }],
      [
        {
          id: MEMBER_ID,
          phone: "6281234564471",
          memberCode: "7KQ2X9",
          cycleStart: "2026-01-10",
          baseTier: 0,
          stamps: [],
        },
      ],
      "2026-03-01",
    );
    expect(linked[0]?.member?.id).toBe(MEMBER_ID);
    expect(linked[0]?.member?.effectiveTier).toBe(0);
  });
});

describe("memberAdminPath", () => {
  test("opens the member card from a query param", () => {
    expect(memberAdminPath(MEMBER_ID)).toBe(`/admin/members?member=${MEMBER_ID}`);
  });
});

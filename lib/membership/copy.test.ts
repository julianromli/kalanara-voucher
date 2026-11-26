import { describe, expect, test } from "vitest";
import { progressCopy } from "@/lib/membership/copy";
import type { MemberSummary } from "@/lib/membership/summary";

function summary(overrides: Partial<MemberSummary>): MemberSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Riesti",
    phone: "6282211117221",
    birthDate: "1990-01-01",
    waConsent: true,
    memberCode: "7KQ2X9",
    source: "cashier",
    createdAt: "2026-03-12T03:00:00Z",
    cardToken: "a".repeat(48),
    stampCount: 4,
    baseTier: 0,
    effectiveTier: 0,
    cycleStart: "2026-03-12",
    rolledCycles: 0,
    tierBefore: null,
    resetOn: "2027-03-12",
    birthday: {
      eligible: false,
      redeemed: false,
      occurrence: "2027-01-01",
      windowStart: "2026-12-29",
      windowEnd: "2027-01-04",
      birthdayYear: 2027,
    },
    lastTreatment: null,
    rewards: [5, 10].map((milestone) => ({
      milestone,
      name: milestone === 5 ? "Treatment gratis" : "Totok gratis",
      note: null,
      claimId: null,
      claimedName: null,
      claimedService: null,
      claimedAt: null,
      claimedByName: null,
    })),
    stamps: [],
    claims: [],
    birthdayRedemptions: [],
    ...overrides,
  };
}

describe("progressCopy after a void", () => {
  test("points at the next reward when nothing is claimed", () => {
    expect(progressCopy(summary({})).title).toBe("1 stamp lagi buat Treatment gratis");
  });

  test("skips a reward already claimed above the count", () => {
    const base = summary({});
    const rewards = base.rewards.map((reward) =>
      reward.milestone === 5
        ? { ...reward, claimId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", claimedName: "Treatment gratis" }
        : reward,
    );
    expect(progressCopy({ ...base, rewards }).title).toBe("6 stamp lagi buat Totok gratis");
  });
});

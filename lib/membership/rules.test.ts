import { describe, expect, test } from "vitest";
import {
  birthdayOccurrence,
  birthdayWindow,
  effectiveTier,
  followupStage,
  nextResetDate,
  rewardState,
  rollCycle,
  tierFromStamps,
} from "@/lib/membership/rules";

describe("membership rules", () => {
  test("maps stamp counts to tiers", () => {
    expect(tierFromStamps(9)).toBe(0);
    expect(tierFromStamps(10)).toBe(1);
    expect(tierFromStamps(19)).toBe(1);
    expect(tierFromStamps(20)).toBe(2);
    expect(tierFromStamps(29)).toBe(2);
    expect(tierFromStamps(30)).toBe(3);
  });

  test("keeps the higher of the stamp tier and the carried tier", () => {
    expect(effectiveTier(0, 2)).toBe(2);
    expect(effectiveTier(12, 0)).toBe(1);
    expect(effectiveTier(30, 1)).toBe(3);
  });

  test("rolls one cycle and drops one tier", () => {
    const rolled = rollCycle({
      cycleStart: "2025-06-01",
      baseTier: 0,
      today: "2026-06-01",
      stampsByCycle: { "2025-06-01": 30 },
    });

    expect(rolled.cycleStart).toBe("2026-06-01");
    expect(rolled.stampCount).toBe(0);
    expect(rolled.baseTier).toBe(2);
    expect(rolled.tierBefore).toBe(3);
    expect(rolled.rolledCycles).toBe(1);
    expect(nextResetDate(rolled.cycleStart)).toBe("2027-06-01");
  });

  test("drops one more tier for each missed cycle", () => {
    const rolled = rollCycle({
      cycleStart: "2024-01-03",
      baseTier: 0,
      today: "2026-01-03",
      stampsByCycle: { "2024-01-03": 30 },
    });

    expect(rolled.rolledCycles).toBe(2);
    expect(rolled.baseTier).toBe(1);
    expect(rolled.stampCount).toBe(0);
    expect(rolled.tierBefore).toBe(3);
  });

  test("moves 29 Feb forward to 28 Feb", () => {
    expect(nextResetDate("2024-02-29")).toBe("2025-02-28");
    expect(birthdayOccurrence("1992-02-29", 2025)).toBe("2025-02-28");
    expect(birthdayOccurrence("1992-02-29", 2024)).toBe("2024-02-29");
  });

  test("uses the birthday nearest to today when the window crosses the new year", () => {
    const window = birthdayWindow("1990-01-03", "2025-12-29");

    expect(window.occurrence).toBe("2026-01-03");
    expect(window.birthdayYear).toBe(2026);
    expect(window.windowStart).toBe("2025-12-27");
    expect(window.windowEnd).toBe("2026-01-10");
    expect(window.inWindow).toBe(true);
  });

  test("keeps the follow-up stage until the next stage starts", () => {
    expect(followupStage(29)).toBeNull();
    expect(followupStage(30)).toBe("day30");
    expect(followupStage(59)).toBe("day30");
    expect(followupStage(60)).toBe("day60");
    expect(followupStage(120)).toBe("day120");
    expect(followupStage(121)).toBe("day120");
  });

  test("hides a claim button when the reward is empty", () => {
    expect(
      rewardState({
        stampCount: 9,
        milestone: 10,
        name: "Treatment gratis",
        claimed: false,
      }),
    ).toBe("locked");
    expect(
      rewardState({
        stampCount: 10,
        milestone: 10,
        name: "Treatment gratis",
        claimed: false,
      }),
    ).toBe("ready");
    expect(
      rewardState({
        stampCount: 15,
        milestone: 15,
        name: null,
        claimed: false,
      }),
    ).toBe("unconfigured");
    expect(
      rewardState({
        stampCount: 10,
        milestone: 10,
        name: "Treatment gratis",
        claimed: true,
      }),
    ).toBe("claimed");
  });
});

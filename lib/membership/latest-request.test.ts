import { describe, expect, test } from "vitest";
import { stampBanner } from "@/lib/membership/copy";
import { createLatestRequestGate } from "@/lib/membership/latest-request";

describe("createLatestRequestGate", () => {
  test("only the newest ticket is latest", () => {
    const gate = createLatestRequestGate();
    const add = gate.begin();
    const undo = gate.begin();
    expect(gate.isLatest(add)).toBe(false);
    expect(gate.isLatest(undo)).toBe(true);
  });

  test("gates are independent", () => {
    const left = createLatestRequestGate();
    const right = createLatestRequestGate();
    const ticket = left.begin();
    right.begin();
    right.begin();
    expect(left.isLatest(ticket)).toBe(true);
  });
});

describe("stampBanner", () => {
  test("reward and tier change together", () => {
    expect(stampBanner({ openedReward: "Treatment gratis", tierBefore: 0, tierAfter: 1 }, "Rina Maharani")).toBe(
      "Treatment gratis kebuka, dan Rina naik ke Bronze. Klaim di daftar reward, sekarang atau di kunjungan berikutnya. Stamp nggak berkurang.",
    );
  });

  test("reward only", () => {
    expect(stampBanner({ openedReward: "Totok gratis", tierBefore: 0, tierAfter: 0 }, "Rina")).toBe(
      "Totok gratis kebuka. Klaim di daftar reward. Stamp nggak berkurang.",
    );
  });

  test("tier change with an unconfigured reward still names the new tier", () => {
    expect(stampBanner({ openedReward: null, tierBefore: 2, tierAfter: 3 }, "Rina Maharani")).toBe("Rina naik ke Gold.");
  });

  test("a plain stamp clears the banner", () => {
    expect(stampBanner({ openedReward: null, tierBefore: 1, tierAfter: 1 }, "Rina")).toBeNull();
    expect(stampBanner({ openedReward: null, tierBefore: null, tierAfter: null }, "Rina")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildScalevPublicOrderUrl, isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";

describe("buildScalevPublicOrderUrl", () => {
  it("builds a public order URL without appending extra path segments", () => {
    expect(buildScalevPublicOrderUrl("secret-token")).toBe(
      "https://app.scalev.id/order/public/secret-token"
    );
  });
});

describe("isScalevHostedPublicOrderUrl", () => {
  it("detects Scalev hosted public order URLs", () => {
    expect(
      isScalevHostedPublicOrderUrl(
        "https://app.scalev.id/order/public/secret-token"
      )
    ).toBe(true);
  });

  it("ignores unrelated URLs", () => {
    expect(isScalevHostedPublicOrderUrl("https://example.com/pay")).toBe(false);
  });
});

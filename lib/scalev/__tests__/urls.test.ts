import { describe, expect, it } from "vitest";
import {
  buildScalevPublicOrderUrl,
  isScalevHostedPublicOrderUrl,
  sanitizeScalevPublicUrl,
} from "@/lib/scalev/urls";

describe("buildScalevPublicOrderUrl", () => {
  it("builds a public order URL without appending extra path segments", () => {
    expect(buildScalevPublicOrderUrl("secret-token")).toBe(
      "https://app.scalev.id/order/public/secret-token"
    );
  });

  it("preserves a configured public base path", () => {
    expect(
      buildScalevPublicOrderUrl(
        "secret-token",
        "https://pay.kalanara.test/scalev"
      )
    ).toBe("https://pay.kalanara.test/scalev/order/public/secret-token");
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

  it("classifies custom public-order and official checkout paths in the browser", () => {
    expect(
      isScalevHostedPublicOrderUrl(
        "https://pay.kalanara.test/order/public/secret-token"
      )
    ).toBe(true);
    expect(
      isScalevHostedPublicOrderUrl(
        "https://checkout.scalev.id/pay/hosted-123"
      )
    ).toBe(true);
  });

  it("ignores unrelated URLs", () => {
    expect(isScalevHostedPublicOrderUrl("https://example.com/pay")).toBe(false);
  });
});

describe("sanitizeScalevPublicUrl", () => {
  it.each([
    "https://app.scalev.id/order/public/secret-token",
    "https://checkout.scalev.id/pay/hosted-123",
    "https://pay.kalanara.test/invoice/123",
  ])("allows trusted HTTPS hosts: %s", (url) => {
    expect(
      sanitizeScalevPublicUrl(url, "https://pay.kalanara.test")
    ).toBe(url);
  });

  it.each([
    "http://app.scalev.id/order/public/secret-token",
    "https://user:pass@app.scalev.id/order/public/secret-token",
    "https://app.scalev.id:8443/order/public/secret-token",
    "https://app.scalev.id.evil.test/order/public/secret-token",
    "https://scalev.id/order/public/secret-token",
    "https://example.com/pay",
  ])("rejects unsafe or non-allowlisted URLs: %s", (url) => {
    expect(
      sanitizeScalevPublicUrl(url, "https://pay.kalanara.test")
    ).toBeNull();
  });

  it("does not trust an invalid configured public base URL", () => {
    expect(
      sanitizeScalevPublicUrl(
        "https://pay.kalanara.test/invoice/123",
        "http://pay.kalanara.test"
      )
    ).toBeNull();
  });
});

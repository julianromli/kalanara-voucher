import { describe, expect, it } from "vitest";
import {
  buildScalevPublicOrderUrl,
  isScalevHostedPublicOrderUrl,
  sanitizeExternalPaymentUrl,
  sanitizeOrderPaymentUrl,
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

  it("ignores query and fragment data when appending the public order path", () => {
    expect(
      buildScalevPublicOrderUrl(
        "secret-token",
        "https://pay.kalanara.test/scalev?campaign=test#checkout"
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
    "https://app.scalev.id/pay/hosted-123",
    "https://app.scalev.id/invoice/123",
    "https://checkout.scalev.id/pay/hosted-123",
    "https://checkout.scalev.id/invoice/123",
    "https://pay.kalanara.test/scalev/pay/123",
  ])("allows trusted HTTPS hosts: %s", (url) => {
    expect(
      sanitizeScalevPublicUrl(url, "https://pay.kalanara.test/scalev")
    ).toBe(url);
  });

  it.each([
    "http://app.scalev.id/order/public/secret-token",
    "https://user:pass@app.scalev.id/order/public/secret-token",
    "https://app.scalev.id:443/order/public/secret-token",
    "https://app.scalev.id:8443/order/public/secret-token",
    "https://app.scalev.id.evil.test/order/public/secret-token",
    "https://scalev.id/order/public/secret-token",
    "https://example.com/pay",
    "https://app.scalev.id/admin",
    "https://checkout.scalev.id/order/public/secret-token",
    "https://pay.kalanara.test/pay/outside-base",
  ])("rejects unsafe or non-allowlisted URLs: %s", (url) => {
    expect(
      sanitizeScalevPublicUrl(url, "https://pay.kalanara.test/scalev")
    ).toBeNull();
  });

  it.each([
    "https://app.scalev.id/pay/../admin",
    "https://app.scalev.id/pay/%2e%2e/admin",
    "https://app.scalev.id/pay/%2E./admin",
    "https://app.scalev.id/pay/%252e%252e/admin",
    "https://pay.kalanara.test/scalev/%2e%2e/pay/123",
  ])("rejects raw or encoded dot-segment traversal: %s", (url) => {
    expect(
      sanitizeScalevPublicUrl(url, "https://pay.kalanara.test/scalev")
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

describe("historical external payment URLs", () => {
  it("preserves structurally safe HTTPS links for non-Scalev orders", () => {
    const mayarUrl = "https://checkout.mayar.id/pay/historical-order";

    expect(sanitizeExternalPaymentUrl(mayarUrl)).toBe(mayarUrl);
    expect(sanitizeOrderPaymentUrl(mayarUrl, "mayar")).toBe(mayarUrl);
  });

  it.each([
    "http://checkout.mayar.id/pay/order",
    "https://user:pass@checkout.mayar.id/pay/order",
    "https://checkout.mayar.id:443/pay/order",
    "https://checkout.mayar.id:8443/pay/order",
  ])("rejects structurally unsafe external links: %s", (url) => {
    expect(sanitizeExternalPaymentUrl(url)).toBeNull();
  });

  it("continues to apply the Scalev allowlist to Scalev orders", () => {
    expect(
      sanitizeOrderPaymentUrl("https://checkout.mayar.id/pay/order", "scalev")
    ).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const protectedAdminPath = join(process.cwd(), "app/admin/(protected)");

describe("paginated admin page contracts", () => {
  test.each([
    ["purchases", "status", "getOrdersPage", "PurchasesClient"],
    ["vouchers", "status", "getVouchersPage", "VouchersClient"],
    ["reviews", "rating", "getAdminReviewsPage", "ReviewsClient"],
  ])(
    "%s owns page/query/%s in the URL and passes one page to %s",
    (route, filterParam, actionName, clientName) => {
      const source = readFileSync(
        join(protectedAdminPath, route, "page.tsx"),
        "utf8",
      );

      expect(source).toMatch(/searchParams:\s*Promise</);
      expect(source).toContain("await searchParams");
      expect(source).toContain("normalizeAdminListParams");
      expect(source).toContain(`filter: raw.${filterParam}`);
      expect(source).toContain(actionName);
      expect(source).toMatch(
        new RegExp(`<${clientName}[\\s\\S]*initialPage=\\{\\w+Page\\}`),
      );
      expect(source).toContain(`requireAdminRouteAccess("/admin/${route}")`);
    },
  );

  test("voucher page passes database-backed global summary counts separately", () => {
    const source = readFileSync(
      join(protectedAdminPath, "vouchers", "page.tsx"),
      "utf8",
    );

    expect(source).toContain("getVoucherAdminSummary()");
    expect(source).toContain("initialSummary={voucherSummary}");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();

describe("third-party script route isolation", () => {
  test("mounts Meta Pixel only in the explicit marketing route group", () => {
    const rootLayout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
    const voucherMarketingLayout = readFileSync(
      resolve(root, "app/(marketing)/layout.tsx"),
      "utf8"
    );
    const landingMarketingLayout = readFileSync(
      resolve(root, "app/(public)/(marketing)/layout.tsx"),
      "utf8"
    );

    expect(rootLayout).not.toContain("MetaPixel");
    for (const marketingLayout of [
      voucherMarketingLayout,
      landingMarketingLayout,
    ]) {
      expect(marketingLayout).toContain('import { MetaPixel }');
      expect(marketingLayout).toContain("<MetaPixel />");
    }
  });

  test("keeps approved marketing URLs while sensitive routes remain outside", () => {
    expect(
      existsSync(resolve(root, "app/(public)/(marketing)/page.tsx"))
    ).toBe(true);
    expect(existsSync(resolve(root, "app/(marketing)/voucher/[id]/page.tsx"))).toBe(
      true
    );

    for (const sensitiveRoute of [
      "app/checkout",
      "app/auth",
      "app/admin",
    ]) {
      expect(existsSync(resolve(root, sensitiveRoute))).toBe(true);
      expect(
        existsSync(resolve(root, "app/(marketing)", sensitiveRoute.slice(4)))
      ).toBe(false);
    }

    for (const publicSensitiveRoute of ["review", "verify"]) {
      expect(
        existsSync(resolve(root, "app/(public)", publicSensitiveRoute))
      ).toBe(true);
      expect(
        existsSync(
          resolve(
            root,
            "app/(public)/(marketing)",
            publicSensitiveRoute
          )
        )
      ).toBe(false);
    }
  });
});

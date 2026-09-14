import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const appRoot = resolve(root, "app");

function getProductionAppSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return getProductionAppSourceFiles(path);
    }

    if (
      !/\.[cm]?[jt]sx?$/.test(entry.name) ||
      /\.test\.[cm]?[jt]sx?$/.test(entry.name)
    ) {
      return [];
    }

    return [path];
  });
}

describe("third-party script route isolation", () => {
  test("mounts Meta Pixel only in the explicit marketing route group", () => {
    const metaPixelFiles = getProductionAppSourceFiles(appRoot)
      .filter((path) => readFileSync(path, "utf8").includes("MetaPixel"))
      .map((path) => relative(appRoot, path).split(sep).join("/"))
      .sort();
    const allowedLayouts = [
      "(marketing)/layout.tsx",
      "(public)/(marketing)/layout.tsx",
    ];

    expect(metaPixelFiles).toEqual(allowedLayouts);

    for (const marketingLayoutPath of allowedLayouts) {
      const marketingLayout = readFileSync(
        resolve(appRoot, marketingLayoutPath),
        "utf8"
      );
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

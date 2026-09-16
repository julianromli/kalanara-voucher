import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const adminRoot = resolve(process.cwd(), "app/admin");
const protectedRoot = resolve(adminRoot, "(protected)");

const PAGE_SKELETONS = [
  ["dashboard", "AdminDashboardSkeleton"],
  ["services", "AdminServicesSkeleton"],
  ["purchases", "AdminTablePageSkeleton"],
  ["reviews", "AdminReviewsSkeleton"],
  ["vouchers", "AdminTablePageSkeleton"],
  ["users", "AdminTablePageSkeleton"],
  ["discount-codes", "AdminTablePageSkeleton"],
  ["crm", "AdminCrmSkeleton"],
  ["settings", "AdminSettingsSkeleton"],
  ["help", "AdminHelpSkeleton"],
] as const;

describe("protected admin loading boundaries", () => {
  test("places each page loader next to its protected page", () => {
    for (const [route, skeleton] of PAGE_SKELETONS) {
      const pagePath = resolve(protectedRoot, route, "page.tsx");
      const loadingPath = resolve(protectedRoot, route, "loading.tsx");
      const orphanPath = resolve(adminRoot, route, "loading.tsx");

      expect(existsSync(pagePath), `${route} page exists`).toBe(true);
      expect(existsSync(loadingPath), `${route} loader is colocated`).toBe(true);
      expect(existsSync(orphanPath), `${route} has no orphan loader`).toBe(false);

      const loadingSource = readFileSync(loadingPath, "utf8");
      expect(loadingSource).toContain(skeleton);
      expect(loadingSource).not.toContain("AdminFallbackSkeleton");
      expect(loadingSource).not.toContain("AdminPageChromeSkeleton");
    }
  });

  test("does not keep a generic protected-segment loader", () => {
    expect(existsSync(resolve(protectedRoot, "loading.tsx"))).toBe(false);
  });

  test("keeps only the admin shell and login loaders outside the protected group", () => {
    const topLevelLoaders = readdirSync(adminRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name === "loading.tsx")
      .map((entry) => entry.name);

    expect(topLevelLoaders).toEqual(["loading.tsx"]);
    expect(existsSync(resolve(adminRoot, "login/loading.tsx"))).toBe(true);
    expect(readFileSync(resolve(adminRoot, "loading.tsx"), "utf8")).toContain(
      "AdminSegmentFallbackSkeleton",
    );
    expect(readFileSync(resolve(adminRoot, "login/loading.tsx"), "utf8")).toContain(
      "AdminLoginSkeleton",
    );
  });
});

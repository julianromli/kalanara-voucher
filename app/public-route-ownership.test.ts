import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const readAppFile = (path: string) =>
  readFileSync(resolve(root, "app", path), "utf8");

describe("public route ownership", () => {
  test("keeps only public-safe global providers in root", () => {
    const rootLayout = readAppFile("layout.tsx");

    expect(rootLayout).toContain("<ToastProvider>");
    expect(rootLayout).not.toContain("AuthProvider");
    expect(rootLayout).not.toContain("@/context/AuthContext");
    expect(rootLayout).not.toContain("Navbar");
    expect(rootLayout).not.toContain("getAnnouncementSettings");
    expect(rootLayout).not.toContain("getSiteSetting");
  });

  test("owns the navbar and its single settings read in the public layout", () => {
    const publicLayout = readAppFile("(public)/layout.tsx");
    const navbar = readFileSync(
      resolve(root, "components/navbar.tsx"),
      "utf8"
    );

    expect(publicLayout).toContain('import Navbar from "@/components/navbar"');
    expect(publicLayout).toContain("getAnnouncementSettings");
    expect(publicLayout.match(/await getAnnouncementSettings\(\)/g)).toHaveLength(
      1
    );
    expect(publicLayout).toContain("<PublicNavbar />");
    expect(navbar).not.toContain("usePathname");
    expect(navbar).not.toContain('startsWith("/checkout")');
  });

  test("preserves URLs while isolating navbar and pixel route trees", () => {
    for (const route of [
      "(public)/(marketing)/page.tsx",
      "(public)/verify/page.tsx",
      "(public)/review/[id]/page.tsx",
      "(marketing)/voucher/[id]/page.tsx",
      "checkout/[id]/page.tsx",
      "admin/layout.tsx",
    ]) {
      expect(existsSync(resolve(root, "app", route))).toBe(true);
    }

    for (const removedRoute of [
      "(marketing)/page.tsx",
      "verify",
      "review",
      "(public)/voucher",
      "(public)/checkout",
      "(public)/admin",
    ]) {
      expect(existsSync(resolve(root, "app", removedRoute))).toBe(false);
    }
  });
});

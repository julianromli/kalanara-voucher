import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const appRoot = resolve(process.cwd(), "app");
const readLayout = (path: string) =>
  readFileSync(resolve(appRoot, path), "utf8");

describe("admin auth layout ownership", () => {
  test("keeps shared admin layout limited to theme ownership", () => {
    const layout = readLayout("admin/layout.tsx");

    expect(layout).toMatch(/<ThemeProvider\b/);
    expect(layout).not.toContain("AuthProvider");
    expect(layout).not.toContain("@/context/AuthContext");
  });

  test("mounts exactly one non-bootstrap provider for admin login", () => {
    const layout = readLayout("admin/login/layout.tsx");

    expect(layout).toMatch(
      /import\s*\{\s*AuthProvider\s*\}\s*from\s*["']@\/context\/AuthContext["']/
    );
    expect(layout.match(/<AuthProvider\s*>/g)).toHaveLength(1);
    expect(layout).not.toContain("bootstrapUser");
  });

  test("retains one server-authorized provider for protected admin routes", () => {
    const layout = readLayout("admin/(protected)/layout.tsx");

    expect(layout).toMatch(
      /const\s+access\s*=\s*await\s+getCurrentAdminAccess\(\)\s*;?/
    );
    expect(layout).toMatch(
      /redirect\(\s*["']\/admin\/login\?error=unauthorized["']\s*\)\s*;?/
    );
    expect(
      layout.match(
        /<AuthProvider\s+bootstrapUser=\{bootstrapUser\}\s*>/g
      )
    )
      .toHaveLength(1);
    expect(layout).toMatch(
      /<AdminShell\s*>\s*\{children\}\s*<\/AdminShell\s*>/
    );
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const appRoot = resolve(process.cwd(), "app");
const readLayout = (path: string) =>
  readFileSync(resolve(appRoot, path), "utf8");

describe("admin auth layout ownership", () => {
  test("keeps shared admin layout limited to theme ownership", () => {
    const layout = readLayout("admin/layout.tsx");

    expect(layout).toContain("<ThemeProvider");
    expect(layout).not.toContain("AuthProvider");
    expect(layout).not.toContain("@/context/AuthContext");
  });

  test("mounts exactly one non-bootstrap provider for admin login", () => {
    const layout = readLayout("admin/login/layout.tsx");

    expect(layout).toContain(
      'import { AuthProvider } from "@/context/AuthContext"'
    );
    expect(layout.match(/<AuthProvider>/g)).toHaveLength(1);
    expect(layout).not.toContain("bootstrapUser");
  });

  test("retains one server-authorized provider for protected admin routes", () => {
    const layout = readLayout("admin/(protected)/layout.tsx");

    expect(layout).toContain(
      "const access = await getCurrentAdminAccess();"
    );
    expect(layout).toContain(
      'redirect("/admin/login?error=unauthorized");'
    );
    expect(layout.match(/<AuthProvider bootstrapUser=\{bootstrapUser\}>/g))
      .toHaveLength(1);
    expect(layout).toContain("<AdminShell>{children}</AdminShell>");
  });
});

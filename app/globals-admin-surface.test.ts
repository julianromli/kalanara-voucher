import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function cssAfterLastUtilitiesLayer(css: string) {
  const lastLayer = css.lastIndexOf("@layer utilities {");
  const layerOpen = css.indexOf("{", lastLayer);
  let depth = 0;

  for (let index = layerOpen; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(index + 1);
      }
    }
  }

  return "";
}

describe("admin surface CSS", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  test("ships admin chrome outside @layer utilities", () => {
    const lastLayer = css.lastIndexOf("@layer utilities {");
    const afterLayer = cssAfterLastUtilitiesLayer(css);

    expect(css.slice(0, lastLayer)).not.toMatch(/\.admin-surface\s*\{/);
    expect(afterLayer).toMatch(/\.admin-surface\s*\{/);
    expect(afterLayer).toMatch(/\.admin-card-hover\s*\{/);
    expect(afterLayer).toMatch(/\.skeleton-shimmer\s*\{/);
    expect(afterLayer).toMatch(/\.skeleton-shimmer::after\s*\{/);
  });

  test("maps semantic colour tokens to the sage/sand palette in light and dark", () => {
    const semantic = [
      "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
      "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
      "accent", "accent-foreground", "border", "input", "ring",
      "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
      "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
      "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
    ];
    const block = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      return css.slice(start, css.indexOf("}", start));
    };

    for (const selector of [":root", ".dark"]) {
      const body = block(selector);
      for (const token of semantic) {
        const line = body.match(new RegExp(`^\\s*--${token}: (oklch\\([^)]*\\));\\s*/\\* (sage|sand)-\\d+ #[0-9a-f]{6}`, "m"));
        expect(line, `${selector} --${token}`).not.toBeNull();
        const chroma = Number(line![1].split(" ")[1]);
        expect(chroma, `${selector} --${token} must not be grey`).toBeGreaterThan(0);
      }
    }
  });

  test("keeps primary text readable against primary in both themes", () => {
    expect(css).toMatch(/:root \{[^}]*--primary: oklch\(0\.519 0\.064 129\.1\); \/\* sage-600/);
    expect(css).toMatch(/\.dark \{[^}]*--primary: oklch\(0\.789 0\.045 126\); \/\* sage-300/);
  });
});

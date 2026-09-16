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
});

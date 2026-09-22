import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { LANDING_COPY_SETTING_KEYS } from "@/lib/landingCopy";
import { LANDING_CMS_CACHE_TAG } from "@/lib/cache-tags";

const landingSeedPath = join(
  process.cwd(),
  "lib/supabase/migrations/029_add_landing_copy_settings.sql"
);
const footerFixPath = join(
  process.cwd(),
  "lib/supabase/migrations/030_fix_landing_footer_seed_routes.sql"
);
const voucherExpiryPath = join(
  process.cwd(),
  "lib/supabase/migrations/028_add_voucher_default_expiration_days.sql"
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("landing copy migrations", () => {
  test("uses 029/030 so they do not collide with voucher expiry 028", () => {
    expect(read(voucherExpiryPath)).toContain("voucher_default_expiration_days");
    expect(read(landingSeedPath)).toContain("landing_footer");
    expect(read(footerFixPath)).toContain("landing_footer");
  });

  test("seeds landing keys without overwriting existing values on conflict", () => {
    const sql = read(landingSeedPath);

    for (const key of LANDING_COPY_SETTING_KEYS) {
      expect(sql).toContain(`'${key}'`);
    }

    expect(sql).toMatch(/on conflict \(key\) do update/i);
    expect(sql).toMatch(/set description = excluded\.description/i);
    expect(sql).not.toMatch(/set value = excluded\.value/i);
  });

  test("only rewrites the original footer seed link pairs", () => {
    const sql = read(footerFixPath);

    expect(sql).toMatch(
      /where key = 'landing_footer'/i
    );
    expect(sql).toContain('%"name":"Tentang Kami","href":"/about"%');
    expect(sql).toContain('%"name":"Hubungi Kami","href":"/contact"%');
    expect(sql).toContain('%"name":"Cara Pembelian","href":"/how-it-works"%');
    expect(sql).toContain('%"name":"FAQ","href":"/faq"%');
    expect(sql).toContain('%"name":"Syarat & Ketentuan","href":"/terms"%');
    expect(sql).toContain('%"name":"Kebijakan Privasi","href":"/privacy"%');
    expect(sql).toContain(
      '"name":"Tentang Kami","href":"/about"'
    );
    expect(sql).not.toMatch(
      /where key = 'landing_footer'\s*;/i
    );
  });

  test("documents the app-side cache purge because SQL cannot touch Next.js cache", () => {
    const sql = read(footerFixPath);

    expect(sql).toContain(LANDING_CMS_CACHE_TAG);
    expect(sql).toMatch(/updateLandingCopySection|\/admin\/crm/i);
    expect(sql).toMatch(/redeploy/i);
  });
});

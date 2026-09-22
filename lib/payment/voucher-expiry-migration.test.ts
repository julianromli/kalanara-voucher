import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY } from "@/lib/payment/voucher-expiry";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/028_add_voucher_default_expiration_days.sql"
);

describe("voucher default expiration days migration", () => {
  test("seeds voucher_default_expiration_days with 90", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain(VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY);
    expect(sql).toMatch(
      /insert into public\.site_settings \(key, value, description\)/i
    );
    expect(sql).toMatch(/'voucher_default_expiration_days'/);
    expect(sql).toMatch(/'90'/);
    expect(sql).toMatch(/on conflict \(key\) do update/i);
  });
});

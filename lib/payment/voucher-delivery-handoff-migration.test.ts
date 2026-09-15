import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/026_add_voucher_delivery_handoff.sql"
);

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

describe("static voucher delivery handoff migration source checks", () => {
  test("statically restricts the narrow definer RPC to service_role", () => {
    const sql = readMigration();

    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function public\.finalize_voucher_delivery_handoff_required\(\s*uuid,\s*uuid,\s*text\s*\)\s+from public,\s*anon,\s*authenticated;/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.finalize_voucher_delivery_handoff_required\(\s*uuid,\s*uuid,\s*text\s*\)\s+to service_role;/i
    );
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*\bto (anon|authenticated)\b/i);
  });
});

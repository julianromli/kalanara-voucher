import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/026_add_voucher_delivery_handoff.sql"
);
const claimMigrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/022_add_voucher_delivery_outbox.sql"
);

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

describe("voucher delivery handoff migration contract", () => {
  test("documents deployment and verification notes and adds the terminal state", () => {
    const sql = readMigration();

    expect(sql).toMatch(/apply notes:/i);
    expect(sql).toMatch(
      /alter type public\.voucher_delivery_status\s+add value(?: if not exists)? 'HANDOFF_REQUIRED'/i
    );
  });

  test("finalizes HANDOFF_REQUIRED only from the matching active claim", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /create function public\.finalize_voucher_delivery_handoff_required\(\s*p_delivery_id uuid,\s*p_claim_token uuid/i
    );
    expect(sql).toMatch(
      /set status = 'HANDOFF_REQUIRED'[\s\S]*claimed_at = null[\s\S]*claim_token = null/i
    );
    expect(sql).toMatch(
      /where outbox\.id = \$1[\s\S]*outbox\.status = 'PROCESSING'[\s\S]*outbox\.claim_token = \$2[\s\S]*using p_delivery_id,\s*p_claim_token/i
    );
  });

  test("exposes the narrow definer RPC to service_role only", () => {
    const sql = readMigration();

    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function public\.finalize_voucher_delivery_handoff_required\(\s*uuid,\s*uuid\s*\)\s+from public,\s*anon,\s*authenticated;/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.finalize_voucher_delivery_handoff_required\(\s*uuid,\s*uuid\s*\)\s+to service_role;/i
    );
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*\bto (anon|authenticated)\b/i);
  });

  test("does not make handoff rows automatically claimable", () => {
    const claimSql = readFileSync(claimMigrationPath, "utf8");
    const claimFunction = claimSql.match(
      /create function public\.claim_voucher_deliveries\([\s\S]*?\$\$;/i
    )?.[0];

    expect(claimFunction).toBeDefined();
    expect(claimFunction).toMatch(/outbox\.status = 'PENDING'/i);
    expect(claimFunction).toMatch(/outbox\.status = 'FAILED'/i);
    expect(claimFunction).toMatch(/outbox\.status = 'PROCESSING'/i);
    expect(claimFunction).not.toMatch(/HANDOFF_REQUIRED/i);
  });
});

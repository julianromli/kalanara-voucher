import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/022_add_voucher_delivery_outbox.sql"
);

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

describe("static voucher delivery outbox migration source checks", () => {
  test("statically declares uniqueness, retry indexes, and restricted access", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /unique index voucher_delivery_outbox_item_channel_unique[\s\S]*\(order_item_id,\s*channel\)[\s\S]*where order_item_id is not null/i
    );
    expect(sql).toMatch(
      /unique index voucher_delivery_outbox_legacy_order_channel_unique[\s\S]*\(order_id,\s*channel\)[\s\S]*where order_item_id is null/i
    );
    expect(sql).toMatch(
      /index voucher_delivery_outbox_retryable_idx[\s\S]*\(next_attempt_at,\s*created_at\)[\s\S]*where status in \('PENDING',\s*'FAILED',\s*'PROCESSING'\)/i
    );
    expect(sql).toMatch(
      /alter table public\.voucher_delivery_outbox enable row level security/i
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toContain("FROM public, anon, authenticated;");
    expect(sql).toContain("TO service_role;");
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*\bto (anon|authenticated)\b/i);
  });
});

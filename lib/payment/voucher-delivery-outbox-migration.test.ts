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

type DeliveryState = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

function isClaimable(
  status: DeliveryState,
  now: number,
  nextAttemptAt: number,
  claimedAt: number | null
) {
  return (
    status === "PENDING" ||
    (status === "FAILED" && nextAttemptAt <= now) ||
    (status === "PROCESSING" &&
      claimedAt !== null &&
      claimedAt < now - 5 * 60_000)
  );
}

describe("voucher delivery outbox migration contract", () => {
  test("allows pending, due failed, and stale processing retries only", () => {
    const now = Date.parse("2026-09-14T12:00:00.000Z");

    expect(isClaimable("PENDING", now, now + 60_000, null)).toBe(true);
    expect(isClaimable("FAILED", now, now, null)).toBe(true);
    expect(isClaimable("FAILED", now, now + 1, null)).toBe(false);
    expect(
      isClaimable("PROCESSING", now, now, now - 5 * 60_000 - 1)
    ).toBe(true);
    expect(
      isClaimable("PROCESSING", now, now, now - 5 * 60_000)
    ).toBe(false);
    expect(isClaimable("SENT", now, now, null)).toBe(false);
  });

  test("defines channel/status enums, source keys, retry index, and deny-by-default RLS", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /create type public\.voucher_delivery_channel as enum\s*\(\s*'EMAIL',\s*'WHATSAPP'\s*\)/i
    );
    expect(sql).toMatch(
      /create type public\.voucher_delivery_status as enum\s*\(\s*'PENDING',\s*'PROCESSING',\s*'SENT',\s*'FAILED'\s*\)/i
    );
    expect(sql).toMatch(/create table public\.voucher_delivery_outbox/i);
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
  });

  test("atomically inserts channels and claims only retryable source rows", () => {
    const sql = readMigration();
    const normalized = sql.toLowerCase();
    const insertPosition = normalized.indexOf(
      "insert into public.voucher_delivery_outbox"
    );
    const lockPosition = normalized.indexOf("for update skip locked");
    const updatePosition = normalized.indexOf(
      "update public.voucher_delivery_outbox as outbox"
    );

    expect(insertPosition).toBeGreaterThan(-1);
    expect(sql).toMatch(/unnest\(p_channels\)/i);
    expect(sql).toMatch(/on conflict do nothing/i);
    expect(sql).toMatch(/outbox\.order_id = p_order_id/i);
    expect(sql).toMatch(
      /outbox\.order_item_id is not distinct from p_order_item_id/i
    );
    expect(sql).toMatch(/outbox\.voucher_id = p_voucher_id/i);
    expect(sql).toMatch(/outbox\.channel = any\(p_channels\)/i);
    expect(sql).toMatch(/outbox\.status = 'PENDING'/i);
    expect(sql).toMatch(
      /outbox\.status = 'FAILED'[\s\S]*outbox\.next_attempt_at <= pg_catalog\.now\(\)/i
    );
    expect(sql).toMatch(
      /outbox\.status = 'PROCESSING'[\s\S]*outbox\.claimed_at < pg_catalog\.now\(\) - interval '5 minutes'/i
    );
    expect(lockPosition).toBeGreaterThan(insertPosition);
    expect(updatePosition).toBeGreaterThan(lockPosition);
    expect(sql).toMatch(/status = 'PROCESSING'/i);
    expect(sql).toMatch(/attempt_count = outbox\.attempt_count \+ 1/i);
    expect(sql).toMatch(
      /claim_token = public\.uuid_generate_v4\(\)[\s\S]*returning outbox\.id,\s*outbox\.channel,\s*outbox\.claim_token/i
    );
  });

  test("requires the current claim token for atomic SENT and FAILED finalization", () => {
    const sql = readMigration();
    const failedFinalization = sql.match(
      /create function public\.finalize_voucher_delivery_failed\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i
    )?.[1];

    expect(sql).toMatch(/claim_token uuid/i);
    expect(sql).toMatch(
      /function public\.finalize_voucher_delivery_sent\(\s*p_delivery_id uuid,\s*p_claim_token uuid/i
    );
    expect(sql).toMatch(
      /function public\.finalize_voucher_delivery_failed\(\s*p_delivery_id uuid,\s*p_claim_token uuid,\s*p_error text/i
    );
    expect(sql).toMatch(
      /where outbox\.id = p_delivery_id[\s\S]*outbox\.status = 'PROCESSING'[\s\S]*outbox\.claim_token = p_claim_token/i
    );
    expect(failedFinalization).toBeDefined();
    expect(failedFinalization).toMatch(
      /pg_catalog\.power\(\s*2,\s*least\(\s*greatest\(outbox\.attempt_count - 1,\s*0\),\s*6\s*\)\s*\)::integer/i
    );
    expect(failedFinalization).toMatch(
      /least\(\s*pg_catalog\.power\([\s\S]*\)::integer,\s*60\s*\)/i
    );
    expect(failedFinalization).not.toMatch(
      /pg_catalog\.(?:least|greatest)\s*\(/i
    );
    expect(sql).toMatch(
      /set status = 'SENT',[\s\S]*claim_token = null[\s\S]*where outbox\.id = p_delivery_id/i
    );
  });

  test("uses the required narrow definer function and grants only service_role", () => {
    const sql = readMigration();

    expect(sql).toMatch(/security definer\s+set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function public\.claim_voucher_deliveries\([\s\S]*\) from public, anon, authenticated;/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.claim_voucher_deliveries\([\s\S]*\) to service_role;/i
    );
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*\bto (anon|authenticated)\b/i);
    expect(sql).not.toMatch(
      /\b(http_post|net\.http|fetch\s*\(|resend\s*\(|send_whatsapp\s*\()/i
    );
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/023_add_admin_dashboard_aggregates.sql",
);

describe("admin dashboard aggregate migration contract", () => {
  test("defines an invoker-rights RPC with a fixed empty search path", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /create or replace function public\.get_admin_dashboard_aggregates\(\)/i,
    );
    expect(sql).toMatch(/returns table\s*\([\s\S]*bucket_date date[\s\S]*\)/i);
    expect(sql).toMatch(/security invoker\s+set search_path = ''/i);
    expect(sql).not.toMatch(/security definer/i);
  });

  test("returns exactly seven typed daily buckets and preserves metric definitions", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/generate_series\(0,\s*6\)/i);
    expect(sql).toMatch(/payment_status = 'COMPLETED'/i);
    expect(sql).toMatch(/not v\.is_redeemed[\s\S]*v\.expiry_date > now\(\)/i);
    expect(sql).toMatch(/not v\.is_redeemed[\s\S]*v\.expiry_date <= now\(\)/i);
    expect(sql).toMatch(/round\(avg\(r\.rating\)::numeric,\s*1\)/i);
  });

  test("allows execution only for the server-side service role", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /revoke all on function public\.get_admin_dashboard_aggregates\(\)\s+from public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.get_admin_dashboard_aggregates\(\)\s+to service_role/i,
    );
    expect(sql).not.toMatch(/\balter role\b/i);
    expect(sql).not.toMatch(/\b(policy|row level security)\b/i);
    expect(sql).not.toMatch(/\b(create index|create extension)\b/i);
  });
});

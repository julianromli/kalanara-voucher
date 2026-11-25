import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/037_member_profile_audit.sql",
);

describe("member profile audit migration contract", () => {
  test("creates a minimal service-role-only audit table", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create table public\.member_profile_audit/i);
    expect(sql).toMatch(/member_id uuid not null references public\.members/i);
    expect(sql).toMatch(/changed_by uuid/);
    expect(sql).toMatch(/changed_by_email/);
    expect(sql).toMatch(/changed_by_role/);
    expect(sql).toMatch(/field text not null/i);
    expect(sql).toMatch(/old_value text/i);
    expect(sql).toMatch(/new_value text/i);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(
      /revoke all on table public\.member_profile_audit from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant all on table public\.member_profile_audit to service_role/i,
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(
      /grant(?:\s+all)?\s+on table public\.member_profile_audit to (?:public|anon|authenticated)/i,
    );
    expect(sql).toMatch(/create or replace function public\.member_update_profile\(/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(
      /revoke all on function public\.member_update_profile\([^)]+\)\s+from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.member_update_profile\([^)]+\)\s+to service_role/i,
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.member_update_profile\([^)]+\)\s+to (?:public|anon|authenticated)/i,
    );
  });
});

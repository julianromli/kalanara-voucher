import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "lib/supabase/migrations/038_member_stamp_corrections.sql"),
  "utf8",
);

const rpcs = [
  "member_stamp_date_problem",
  "member_write_stamp_audit",
  "member_correct_void_stamp",
  "member_correct_stamp_service",
  "member_correct_stamp_date",
  "member_add_past_stamp",
  "list_member_stamp_history",
];

function functionBody(name: string): string {
  const start = sql.search(new RegExp(String.raw`^CREATE FUNCTION public\.${name}\(`, "m"));
  if (start < 0) throw new Error(`missing function ${name}`);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end + 4);
}

describe("member stamp corrections migration contract", () => {
  test("creates a service-role-only audit table with who, role, email, old, new and reason", () => {
    expect(sql).toMatch(/create table public\.member_stamp_audit/i);
    expect(sql).toMatch(/member_id uuid not null references public\.members \(id\) on delete cascade/i);
    expect(sql).toMatch(/stamp_id uuid not null references public\.member_stamps \(id\) on delete cascade/i);
    const table = sql.slice(
      sql.indexOf("CREATE TABLE public.member_stamp_audit"),
      sql.indexOf("CREATE INDEX member_stamp_audit_member_created_idx"),
    );
    for (const column of [
      "changed_by uuid,",
      "changed_by_email text,",
      "changed_by_role text,",
      "old_value text,",
      "new_value text,",
      "reason text,",
      "service_name text NOT NULL,",
      "visit_date date NOT NULL,",
      "created_at timestamptz NOT NULL DEFAULT now(),",
    ]) {
      expect(table).toMatch(new RegExp(`\\n  ${column.replace(/[()]/g, "\\$&")}\\n`));
    }
    expect(sql).toMatch(/action IN \('void', 'service', 'visit_date', 'add_past'\)/);
    expect(sql).toMatch(/reason IS NULL OR char_length\(reason\) BETWEEN 1 AND 200/);
    expect(sql).toMatch(/alter table public\.member_stamp_audit enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.member_stamp_audit from public, anon, authenticated/i);
    expect(sql).toMatch(/grant all on table public\.member_stamp_audit to service_role/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant[^;]*to (?:public|anon|authenticated)/i);
  });

  test("never deletes a stamp and keeps applied migrations untouched", () => {
    expect(sql).not.toMatch(/delete from public\.member_stamps/i);
    expect(sql).not.toMatch(/create or replace function/i);
    expect(sql).not.toMatch(/drop (?:function|table|index)/i);
  });

  test.each(rpcs)("%s is SECURITY INVOKER with an empty search_path and service_role execute only", (name) => {
    const body = functionBody(name);
    expect(body).toMatch(/SECURITY INVOKER/);
    expect(body).not.toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = ''/);
    expect(sql).toMatch(
      new RegExp(String.raw`REVOKE ALL ON FUNCTION public\.${name}\([^)]*\)\s+FROM PUBLIC, anon, authenticated;`),
    );
    expect(sql).toMatch(
      new RegExp(String.raw`GRANT EXECUTE ON FUNCTION public\.${name}\([^)]*\)\s+TO service_role;`),
    );
  });

  test("period bounds: on or after cycle_start, before the reset, not after today in Jakarta", () => {
    const body = functionBody("member_stamp_date_problem");
    expect(body).toMatch(/p_visit_date > \(now\(\) AT TIME ZONE 'Asia\/Jakarta'\)::date THEN 'future_date'/);
    expect(body).toMatch(/p_visit_date < p_cycle_start THEN 'outside_period'/);
    expect(body).toMatch(/p_visit_date >= \(p_cycle_start \+ interval '12 months'\)::date THEN 'outside_period'/);
    for (const name of ["member_correct_stamp_date", "member_add_past_stamp"]) {
      expect(functionBody(name)).toMatch(/public\.member_stamp_date_problem\(member_row\.cycle_start, p_visit_date\)/);
    }
  });

  test.each(["member_correct_void_stamp", "member_correct_stamp_service", "member_correct_stamp_date"])(
    "%s locks the member, then the stamp, and only edits the current period",
    (name) => {
      const body = functionBody(name);
      const roll = body.indexOf("public.member_roll_cycle(stamp_member_id)");
      const lock = body.indexOf("FOR UPDATE");
      expect(roll).toBeGreaterThan(0);
      expect(lock).toBeGreaterThan(roll);
      expect(body).toMatch(/IF stamp_row\.voided_at IS NOT NULL THEN\s+RETURN jsonb_build_object\('status', 'already_voided'\)/);
      expect(body).toMatch(/IF stamp_row\.cycle_start <> member_row\.cycle_start THEN\s+RETURN jsonb_build_object\('status', 'outside_period'\)/);
    },
  );

  test("void is soft and asks before dropping under a claimed reward", () => {
    const body = functionBody("member_correct_void_stamp");
    expect(body).toMatch(/SET\s+voided_at = now\(\),\s+voided_by = p_changed_by/);
    expect(body).toMatch(/claim\.milestone > count_after/);
    expect(body).toMatch(/'status', 'needs_confirm_claimed'/);
    expect(body).toMatch(/NOT COALESCE\(p_confirm_claimed, false\)/);
    expect(body).not.toMatch(/DELETE FROM public\.member_reward_claims/);
    expect(body).toMatch(/'claims_kept', affected/);
  });

  test("two stamps on one day need confirm, and a period holds at most 30", () => {
    expect(functionBody("member_correct_stamp_date")).toMatch(/'status', 'needs_confirm'/);
    const add = functionBody("member_add_past_stamp");
    expect(add).toMatch(/'status', 'needs_confirm'/);
    expect(add).toMatch(/IF stamp_count >= 30 THEN/);
    expect(add).toMatch(/services\.is_active = true/);
    expect(functionBody("member_correct_stamp_service")).toMatch(/services\.is_active = true/);
  });

  test("every correction writes an audit row with the author and reason", () => {
    const actions: Record<string, string> = {
      member_correct_void_stamp: "'void'",
      member_correct_stamp_service: "'service'",
      member_correct_stamp_date: "'visit_date'",
      member_add_past_stamp: "'add_past'",
    };
    for (const [name, action] of Object.entries(actions)) {
      const body = functionBody(name);
      expect(body).toContain("PERFORM public.member_write_stamp_audit(");
      expect(body).toContain(action);
      expect(body).toMatch(/p_reason,[\s\S]*p_changed_by,\s+p_changed_by_email,\s+p_changed_by_role/);
    }
    expect(functionBody("member_write_stamp_audit")).toMatch(/NULLIF\(btrim\(COALESCE\(p_reason, ''\)\), ''\)/);
  });

  test("history read model includes voided stamps of the current period only", () => {
    const body = functionBody("list_member_stamp_history");
    expect(body).toMatch(/public\.member_preview_cycle\(/);
    expect(body).toMatch(/stamp\.cycle_start = preview\.cycle_start/);
    expect(body).not.toMatch(/stamp\.voided_at IS NULL/);
    expect(body).toMatch(/FROM public\.member_stamp_audit AS audit/);
  });
});

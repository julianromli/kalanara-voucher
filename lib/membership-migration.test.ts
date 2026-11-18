import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationDir = join(process.cwd(), "lib/supabase/migrations");
const migrationPath = join(migrationDir, "033_membership.sql");
const cronPath = join(migrationDir, "034_membership_cron.sql");
const fixesPath = join(migrationDir, "035_membership_fixes.sql");

// Normalized CREATE FUNCTION text of applied 033 overlaid with applied 035.
// member_void_stamp refuses an undo below a claimed milestone and passes 0::smallint.
const endStateFunctionHashes: Record<string, string> = {
  member_void_stamp:
    "3d75941afc5acd541e982b931409251d50a5916f5876ac1b0c2007fc263a92a2",
  list_recent_members:
    "e7d9e8b539db28bb8582b009160ab7d6cb957f5ba753d2c3bf019dfff49f65da",
  member_save_rewards:
    "8a51b31c436cf978e31e6f70f9fd283308fc4e1559da72736bec2d41a77ebf32",
  member_self_signup:
    "85fc1696062690acaba66e73a27a7dcad6fa1a264cc66a1276d3979ba2aa80b3",
};

function readMigration(path: string): string {
  return readFileSync(path, "utf8");
}

function functionBodies(sql: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const parts = sql.split(/(?=^CREATE (?:OR REPLACE )?FUNCTION public\.)/m);
  for (const part of parts) {
    const match = part.match(/^CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)/);
    if (!match) continue;
    const end = part.indexOf("\n$$;");
    if (end < 0) throw new Error(`Unclosed function ${match[1]}`);
    bodies.set(
      match[1],
      part.slice(0, end + 4).replace(/^CREATE OR REPLACE FUNCTION/, "CREATE FUNCTION"),
    );
  }
  return bodies;
}

const tables = [
  "members",
  "member_stamps",
  "member_rewards",
  "member_reward_claims",
  "member_birthday_redemptions",
  "member_followups",
  "member_signup_qr",
];

describe("membership nightly migration contract", () => {
  test("schedules one replaceable job and caches follow-ups", () => {
    const sql = readMigration(cronPath);

    expect(sql).toMatch(/create table public\.member_followup_due/i);
    expect(sql).toMatch(
      /alter table public\.member_followup_due enable row level security/i,
    );
    expect(sql).toMatch(/member_nightly_maintenance/i);
    expect(sql).toMatch(/membership-nightly/);
    expect(sql).toMatch(/0 19 \* \* \*/);
    expect(sql.match(/cron\.schedule\s*\(/gi)).toHaveLength(1);
    expect(sql).toMatch(/cron\.unschedule[\s\S]*membership-nightly/);
    expect(sql).toMatch(/cron\.schedule\(\s*'membership-nightly'/);
    expect(sql).toMatch(/delete from public\.member_followup_due/i);
    expect(sql).toMatch(
      /insert into public\.member_followup_due[\s\S]*from public\.list_member_followups\(\)/i,
    );
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/heartbeat-6hours|keep-alive-edge-function/i);
  });
});

describe("membership migration contract", () => {
  test("enables RLS on every new table and keeps service_role access", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of tables) {
      expect(sql).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `revoke all on table public\\.${table} from public, anon, authenticated`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(`grant all on table public\\.${table} to service_role`, "i"),
      );
    }
  });

  test("keeps functions invoker-only with an empty search path", () => {
    const applied = readMigration(migrationPath);
    const fixes = readMigration(fixesPath);
    const cron = readMigration(cronPath);
    for (const sql of [applied, fixes, cron]) {
      const bodies = functionBodies(sql);
      expect(bodies.size).toBeGreaterThan(0);
      for (const [name, body] of bodies) {
        const withoutComments = body
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/--.*$/gm, "");
        expect(withoutComments, name).toMatch(/set search_path = ''/i);
        expect(withoutComments, name).toMatch(/security invoker/i);
        expect(withoutComments, name).not.toMatch(/security definer/i);
      }
      expect(sql).not.toMatch(
        /grant\s+(execute|all|select|insert|update|delete|usage)\b[\s\S]{0,180}\bto\s+(anon|authenticated)\b/i,
      );
    }
  });

  test("locks reward milestones and seeds the defaults", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /check\s*\(\s*milestone in \(5,\s*10,\s*15,\s*20,\s*25,\s*30\)\s*\)/i,
    );
    expect(sql).toMatch(/'Totok gratis'/);
    expect(sql).toMatch(/'Treatment gratis'/);
    expect(sql).toMatch(/member_signup_qr_one_active_idx/);
    expect(sql).toMatch(/encode\(extensions\.gen_random_bytes\(24\), 'hex'\)/);
    expect(sql).toMatch(/encode\(extensions\.gen_random_bytes\(16\), 'hex'\)/);
    expect(sql).toMatch(/membership\.followup\.day30/);
    expect(sql).toMatch(/membership\.followup\.birthday/);
    expect(sql).toMatch(/char_length\(service_name\) BETWEEN 1 AND 80/i);
    expect(sql).not.toMatch(/member_save_rewards|member_self_signup/);
  });
});

describe("membership fixes migration contract", () => {
  test("replaces changed functions and adds the new ones on top of 033", () => {
    const applied = functionBodies(readMigration(migrationPath));
    const fixes = readMigration(fixesPath);
    const delta = functionBodies(fixes);
    const merged = new Map(applied);

    expect(fixes).toMatch(
      /alter table public\.member_stamps\s+drop constraint member_stamps_service_name_length/i,
    );
    expect(fixes).toMatch(/char_length\(btrim\(service_name\)\) >= 1/i);

    for (const name of ["member_void_stamp", "list_recent_members"]) {
      expect(fixes).toMatch(
        new RegExp(`create or replace function public\\.${name}\\b`, "i"),
      );
      expect(applied.has(name)).toBe(true);
    }
    for (const name of ["member_save_rewards", "member_self_signup"]) {
      expect(fixes).toMatch(new RegExp(`create function public\\.${name}\\b`, "i"));
      expect(applied.has(name)).toBe(false);
    }

    for (const [name, body] of delta) {
      merged.set(name, body);
      const digest = createHash("sha256").update(body).digest("hex");
      expect(digest).toBe(endStateFunctionHashes[name]);
      expect(body).toMatch(/SECURITY INVOKER/);
      expect(body).toMatch(/SET search_path = ''/);
      expect(fixes).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^\\n]*\\) from public, anon, authenticated`,
          "i",
        ),
      );
      expect(fixes).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^\\n]*\\) to service_role`, "i"),
      );
    }

    expect(merged.size).toBe(applied.size + 2);
    expect([...delta.keys()]).toEqual([
      "member_void_stamp",
      "list_recent_members",
      "member_save_rewards",
      "member_self_signup",
    ]);
  });
});

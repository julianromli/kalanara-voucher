import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/033_membership.sql",
);

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
    const sql = readFileSync(
      join(process.cwd(), "lib/supabase/migrations/034_membership_cron.sql"),
      "utf8",
    );

    expect(sql).toMatch(/create table public\.member_followup_due/i);
    expect(sql).toMatch(
      /alter table public\.member_followup_due enable row level security/i,
    );
    expect(sql).toMatch(/member_nightly_maintenance/i);
    expect(sql).toMatch(/membership-nightly/);
    expect(sql).toMatch(/0 19 \* \* \*/);
    expect(sql).toMatch(/cron\.unschedule/i);
    expect(sql).toMatch(/delete from public\.member_followup_due/i);
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
    const sql = readFileSync(migrationPath, "utf8");
    const functionCount = sql.match(/create function public\./gi)?.length ?? 0;
    const searchPathCount = sql.match(/set search_path = ''/gi)?.length ?? 0;

    expect(functionCount).toBeGreaterThan(0);
    expect(searchPathCount).toBe(functionCount);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(
      /grant\s+(execute|all|select|insert|update|delete|usage)\b[\s\S]{0,180}\bto\s+(anon|authenticated)\b/i,
    );
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
  });
});

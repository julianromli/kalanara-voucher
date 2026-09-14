import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/025_add_admin_order_search.sql",
);

describe("admin order search migration contract", () => {
  test("returns order rows with invoker rights and service-name matching", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /create or replace function public\.search_admin_orders\(search_query text\)/i,
    );
    expect(sql).toMatch(/returns setof public\.orders/i);
    expect(sql).toMatch(/security invoker\s+set search_path = ''/i);
    expect(sql).toMatch(/s\.name ilike/i);
    expect(sql).toMatch(/public\.order_items/i);
    expect(sql).toMatch(/public\.vouchers/i);
  });

  test("is executable only by service_role and documents rollout order", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /revoke all on function public\.search_admin_orders\(text\)\s+from public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.search_admin_orders\(text\)\s+to service_role/i,
    );
    expect(sql).toMatch(/apply this migration before deploying/i);
    expect(sql).not.toMatch(/security definer/i);
  });
});

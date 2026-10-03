import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/032_admin_buyers_and_search.sql",
);

describe("admin buyer search migration contract", () => {
  test("groups buyers from orders and keeps invoker rights", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /create or replace function public\.list_admin_buyers\(search_query text\)/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.list_admin_buyer_orders\(buyer_phone text\)/i,
    );
    expect(sql).toMatch(/security invoker\s+set search_path = ''/i);
    expect(sql).toMatch(/normalize_admin_phone/);
    expect(sql).toMatch(/customer_phone/);
    expect(sql).toMatch(/v\.code/);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/create table/i);
  });

  test("is executable only by service_role", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /grant execute on function public\.list_admin_buyers\(text\)\s+to service_role/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.search_admin_orders\(text\)\s+to service_role/i,
    );
  });
});

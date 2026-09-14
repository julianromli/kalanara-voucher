import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "lib/supabase/migrations/024_harden_payment_fulfillment.sql"),
  "utf8"
);

describe("payment fulfillment corrective migration", () => {
  test("collects linked and source item vouchers before order-item cascade", () => {
    expect(sql).toMatch(
      /select order_items\.voucher_id[\s\S]*order_items\.order_id = any\(target_order_ids\)/i
    );
    expect(sql).toMatch(
      /vouchers\.source_order_item_id in \([\s\S]*from public\.order_items[\s\S]*order_id = any\(target_order_ids\)/i
    );
    expect(sql).toMatch(
      /detached_order_items[\s\S]*update public\.order_items[\s\S]*set voucher_id = null/i
    );
    expect(sql.indexOf("deleted_vouchers AS")).toBeLessThan(
      sql.indexOf("deleted_orders AS")
    );
  });

  test("removes the legacy anonymous order update policy", () => {
    expect(sql).toMatch(
      /drop policy if exists "orders_anon_update" on public\.orders/i
    );
  });

  test("uses an empty search path and service-role-only execution", () => {
    expect(sql).toMatch(/security invoker\s+set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function public\.hard_delete_orders\(uuid\[\]\)\s+from public, anon, authenticated/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.hard_delete_orders\(uuid\[\]\)\s+to service_role/i
    );
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "lib/supabase/migrations/024_harden_payment_fulfillment.sql"),
  "utf8"
);

describe("payment fulfillment corrective migration", () => {
  test("locks target orders and items deterministically before scanning voucher relationships", () => {
    const normalizedSql = sql.toLowerCase();
    const orderLock = sql.match(
      /perform 1\s+from public\.orders\s+where orders\.id = any\(target_order_ids\)\s+order by orders\.id\s+for update;/i
    );
    const orderItemLock = sql.match(
      /perform 1\s+from public\.order_items\s+where order_items\.order_id = any\(target_order_ids\)\s+order by order_items\.id\s+for update;/i
    );
    const orderLockPosition = orderLock?.index ?? -1;
    const orderItemLockPosition = orderItemLock?.index ?? -1;
    const relationshipScanPosition = normalizedSql.indexOf(
      "select coalesce(array_agg(distinct vouchers.id)"
    );

    expect(orderLockPosition).toBeGreaterThan(-1);
    expect(orderItemLockPosition).toBeGreaterThan(-1);
    expect(relationshipScanPosition).toBeGreaterThan(-1);
    expect(orderLockPosition).toBeLessThan(orderItemLockPosition);
    expect(orderItemLockPosition).toBeLessThan(relationshipScanPosition);
  });

  test("collects linked and source item vouchers before order-item cascade", () => {
    expect(sql).toMatch(
      /select order_items\.voucher_id[\s\S]*order_items\.order_id = any\(target_order_ids\)/i
    );
    expect(sql).toMatch(
      /vouchers\.source_order_item_id in \([\s\S]*from public\.order_items[\s\S]*order_id = any\(target_order_ids\)/i
    );
    expect(sql).toMatch(
      /update public\.order_items\s+set voucher_id = null[\s\S]*where public\.order_items\.id = any\(target_order_item_ids\)/i
    );
    expect(sql.indexOf("INTO related_voucher_ids")).toBeLessThan(
      sql.indexOf("DELETE FROM public.scalev_webhook_events")
    );
  });

  test("detaches voucher links and deletes rows in separate sequential statements", () => {
    expect(sql).not.toMatch(
      /\bwith\s+\w+\s+as\s*\(\s*(?:delete|update)\b/i
    );
    expect(sql).not.toMatch(
      /\),\s*\w+\s+as\s*\(\s*(?:delete|update)\b/i
    );
    expect(sql).toMatch(
      /delete from public\.scalev_webhook_events[\s\S]*?;\s*get diagnostics deleted_webhook_event_count = row_count;\s*update public\.orders[\s\S]*?;\s*update public\.order_items[\s\S]*?;\s*delete from public\.reviews[\s\S]*?;\s*get diagnostics deleted_review_count = row_count;\s*delete from public\.vouchers[\s\S]*?;\s*get diagnostics deleted_voucher_count = row_count;\s*delete from public\.orders[\s\S]*?;\s*get diagnostics deleted_order_count = row_count;\s*return query/i
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

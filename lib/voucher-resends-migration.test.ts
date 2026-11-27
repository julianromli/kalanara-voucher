import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "lib/supabase/migrations/039_voucher_resends.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const start = sql.search(new RegExp(String.raw`^CREATE FUNCTION public\.${name}\(`, "m"));
  if (start < 0) throw new Error(`missing function ${name}`);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end + 4);
}

describe("voucher resends migration contract", () => {
  test("creates a service-role-only audit table with who, role, email, target and result", () => {
    const table = sql.slice(
      sql.indexOf("CREATE TABLE public.voucher_delivery_resends"),
      sql.indexOf("CREATE INDEX voucher_delivery_resends_voucher_created_idx"),
    );
    for (const column of [
      "voucher_id uuid NOT NULL REFERENCES public.vouchers (id) ON DELETE CASCADE,",
      "order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,",
      "target_email text,",
      "target_phone text,",
      "previous_recipient_email text,",
      "requested_by uuid,",
      "requested_by_email text,",
      "requested_by_role text,",
      "created_at timestamptz NOT NULL DEFAULT now(),",
    ]) {
      expect(table).toContain(`\n  ${column}\n`);
    }
    expect(sql).toMatch(/channel IN \('EMAIL', 'WHATSAPP_LINK'\)/);
    expect(sql).toMatch(/target_kind IN \('RECIPIENT', 'BUYER', 'CUSTOM'\)/);
    expect(sql).toMatch(/status IN \('PENDING', 'SENT', 'FAILED', 'COPIED'\)/);
    expect(sql).toMatch(/alter table public\.voucher_delivery_resends enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.voucher_delivery_resends from public, anon, authenticated/i);
    expect(sql).toMatch(/grant all on table public\.voucher_delivery_resends to service_role/i);
    expect(sql).toMatch(/create index voucher_delivery_resends_voucher_created_idx\s+on public\.voucher_delivery_resends \(voucher_id, created_at desc\)/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant[^;]*to (?:public|anon|authenticated)/i);
  });

  test.each(["voucher_resend_begin", "voucher_resend_finish"])(
    "%s is SECURITY INVOKER with an empty search_path and service-role execute only",
    (name) => {
      const body = functionBody(name);
      expect(body).toMatch(/SECURITY INVOKER/);
      expect(body).not.toMatch(/SECURITY DEFINER/);
      expect(body).toMatch(/SET search_path = ''/);
      expect(sql).toMatch(new RegExp(String.raw`REVOKE ALL ON FUNCTION public\.${name}\([^)]*\)\s+FROM PUBLIC, anon, authenticated;`));
      expect(sql).toMatch(new RegExp(String.raw`GRANT EXECUTE ON FUNCTION public\.${name}\([^)]*\)\s+TO service_role;`));
    },
  );

  test("begin checks paid, redeemed, expired, ownership and the 3 per hour, 60 second limit under a lock", () => {
    const body = functionBody("voucher_resend_begin");
    expect(body).toMatch(/payment_status <> 'COMPLETED'/);
    expect(body).toMatch(/v_voucher\.is_redeemed/);
    expect(body).toMatch(/expiry_date <= now\(\)/);
    expect(body).toMatch(/item\.voucher_id = v_voucher\.id/);
    expect(body).toMatch(/v_order\.voucher_id IS DISTINCT FROM v_voucher\.id/);
    expect(body).toMatch(/pg_advisory_xact_lock/);
    expect(body).toMatch(/interval '1 hour'/);
    expect(body).toMatch(/v_last > now\(\) - interval '60 seconds' THEN/);
    expect(body).toMatch(/IF v_recent >= 3 THEN/);
    // The lock comes before the count, and both before the insert.
    const lock = body.indexOf("pg_advisory_xact_lock");
    const count = body.indexOf("count(*)");
    const insert = body.indexOf("INSERT INTO public.voucher_delivery_resends");
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(count);
    expect(count).toBeLessThan(insert);
  });

  test("finish records the address it replaced, read under the voucher lock", () => {
    const body = functionBody("voucher_resend_finish");
    const read = body.search(/SELECT voucher\.recipient_email INTO v_replaced[\s\S]*?FOR UPDATE;/);
    const update = body.indexOf("UPDATE public.vouchers");
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(update);
    expect(body).toMatch(/previous_recipient_email = CASE WHEN v_updated THEN v_replaced ELSE previous_recipient_email END/);
  });

  test("finish updates the recipient email only after a send that asked for it", () => {
    const body = functionBody("voucher_resend_finish");
    expect(body).toMatch(/IF p_sent AND v_row\.save_as_recipient THEN/);
    expect(body).toMatch(/UPDATE public\.vouchers\s+SET recipient_email = v_row\.target_email/);
    expect(body).toMatch(/status = 'PENDING'/);
  });

  test("never touches the order delivery outbox or deletes vouchers", () => {
    expect(sql).not.toMatch(/voucher_delivery_outbox/i);
    expect(sql).not.toMatch(/delete from/i);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = join(
  process.cwd(),
  "lib/supabase/migrations/021_enforce_payment_state_machine.sql"
);
const databaseTypesPath = join(process.cwd(), "lib/database.types.ts");

type Status = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

function transitionAccepted(current: Status, target: Status) {
  return (
    current === target ||
    (current === "PENDING" && ["COMPLETED", "FAILED"].includes(target)) ||
    (current === "COMPLETED" && target === "REFUNDED")
  );
}

describe("payment state migration contract", () => {
  test("defines the complete transition matrix", () => {
    const statuses: Status[] = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"];
    const acceptedPairs = statuses.flatMap((current) =>
      statuses
        .filter((target) => transitionAccepted(current, target))
        .map((target) => `${current}->${target}`)
    );

    expect(acceptedPairs).toEqual([
      "PENDING->PENDING",
      "PENDING->COMPLETED",
      "PENDING->FAILED",
      "COMPLETED->COMPLETED",
      "COMPLETED->REFUNDED",
      "FAILED->FAILED",
      "REFUNDED->REFUNDED",
    ]);
  });

  test("serializes row transitions and rejects stale or conflicting observations", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const normalizedSql = sql.toLowerCase();

    expect(sql).toMatch(/from public\.orders as o[\s\S]*for update;/i);
    expect(sql).toMatch(/p_expected_version <> v_version/i);
    expect(sql).toContain("'version_conflict'");
    expect(sql).toMatch(
      /not p_provider_event_at_is_fallback[\s\S]*v_event_at is not null[\s\S]*p_provider_event_at < v_event_at/i
    );
    expect(sql).toContain("'stale_provider_event'");
    expect(sql).toMatch(
      /v_status = 'PENDING'[\s\S]*p_target_status in \('COMPLETED', 'FAILED'\)/i
    );
    expect(sql).toMatch(
      /v_status = 'COMPLETED'[\s\S]*p_target_status = 'REFUNDED'/i
    );
    expect(sql).toMatch(/payment_state_version = o\.payment_state_version \+ 1/i);
    expect(normalizedSql.indexOf("for update;")).toBeLessThan(
      normalizedSql.indexOf("p_expected_version <> v_version")
    );
  });

  test("rejects without an update and keeps assignments explicit", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const normalizedSql = sql.toLowerCase();
    const updatePosition = normalizedSql.indexOf("update public.orders as o");

    for (const reason of [
      "not_found",
      "missing_provider_event_at",
      "version_conflict",
      "stale_provider_event",
      "transition_rejected",
    ]) {
      expect(normalizedSql.indexOf(`'${reason}'`)).toBeGreaterThan(-1);
      expect(normalizedSql.indexOf(`'${reason}'`)).toBeLessThan(updatePosition);
    }

    expect(sql).not.toMatch(/jsonb_populate_record|execute\s+format|p_column/i);
    for (const column of [
      "payment_transaction_id",
      "payment_type",
      "payment_transaction_time",
      "payment_link",
      "scalev_order_pk",
      "scalev_order_id",
      "scalev_pg_reference_id",
      "scalev_payment_method",
      "scalev_sub_payment_method",
      "scalev_store_unique_id",
      "scalev_raw_status",
      "scalev_raw_payment_status",
      "scalev_last_checked_at",
    ]) {
      expect(sql).toMatch(new RegExp(`${column}\\s*=`, "i"));
    }
  });

  test("uses invoker rights, an empty search path, and service-role-only execute", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/security invoker\s+set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function public\.transition_order_payment_state\([\s\S]*\) from public, anon, authenticated;/i
    );
    expect(sql).toMatch(
      /grant execute on function public\.transition_order_payment_state\([\s\S]*\) to service_role;/i
    );
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*\bto (anon|authenticated)\b/i);
  });

  test("uses input provenance without storing fallback state and preserves genuine timestamps", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const databaseTypes = readFileSync(databaseTypesPath, "utf8");

    expect(sql).toMatch(/p_provider_event_at_is_fallback boolean/i);
    expect(databaseTypes).toMatch(/p_provider_event_at_is_fallback\?: boolean/);
    expect(databaseTypes).not.toMatch(
      /^\s+payment_provider_event_at_is_fallback[?:]/m
    );
    expect(sql).not.toMatch(
      /(?:column|o\.|v_)payment_provider_event_at_is_fallback/i
    );
    expect(sql).toMatch(
      /payment_provider_event_at = case[\s\S]*when p_provider_event_at_is_fallback[\s\S]*then o\.payment_provider_event_at[\s\S]*else p_provider_event_at[\s\S]*end/i
    );
    expect(sql).toMatch(
      /payment_transaction_time = case[\s\S]*when p_provider_event_at_is_fallback[\s\S]*then o\.payment_transaction_time[\s\S]*else coalesce\(p_transaction_time, o\.payment_transaction_time\)[\s\S]*end/i
    );
    expect(sql).toMatch(
      /fallback receipt time is tracked only in scalev_last_checked_at/i
    );
    expect(sql).toMatch(
      /drop policy if exists "orders_anon_update" on public\.orders/i
    );
  });
});

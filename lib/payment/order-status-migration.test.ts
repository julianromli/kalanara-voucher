import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "lib/supabase/migrations/020_add_order_status_sessions.sql"
  ),
  "utf8"
).toLowerCase();

describe("order status session migration", () => {
  test("cascades session deletion with its order", () => {
    expect(migration).toMatch(
      /order_id uuid not null\s+references public\.orders\(id\)\s+on delete cascade/
    );
  });

  test("keeps browser database roles out of the session table", () => {
    expect(migration).toContain(
      "alter table public.order_status_sessions enable row level security"
    );
    expect(migration).toContain(
      "revoke all on table public.order_status_sessions from anon, authenticated"
    );
    expect(migration).toContain(
      "grant select, insert, delete on table public.order_status_sessions to service_role"
    );
    expect(migration).not.toMatch(/create policy/);
  });

  test("indexes order-bound resolution and expired-session cleanup", () => {
    expect(migration).toContain(
      "on public.order_status_sessions (order_id, expires_at)"
    );
    expect(migration).toContain(
      "on public.order_status_sessions (expires_at)"
    );
  });
});

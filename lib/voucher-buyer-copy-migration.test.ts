import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "lib/supabase/migrations/040_voucher_buyer_copy_email.sql"),
  "utf8",
);
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("buyer copy migration contract", () => {
  test("only adds the EMAIL_BUYER_COPY channel", () => {
    expect(statements).toMatch(
      /ALTER TYPE public\.voucher_delivery_channel\s+ADD VALUE IF NOT EXISTS 'EMAIL_BUYER_COPY';/,
    );
    expect(statements.match(/;/g)).toHaveLength(1);
  });

  test("changes no table, policy or grant", () => {
    expect(statements).not.toMatch(/create (table|policy)|grant|revoke|drop|delete|update /i);
  });
});

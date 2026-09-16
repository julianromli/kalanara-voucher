import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  ADMIN_SURFACE_CLASS,
  AdminSurface,
} from "@/components/admin/admin-page";
import { AdminDashboardSkeleton } from "@/components/admin/admin-skeletons";
import { RecentOrders } from "@/components/admin/recent-orders";
import { StatCard } from "@/components/admin/stat-card";
import { VoucherSummary } from "@/components/admin/voucher-summary";

function expectCardChrome(element: Element | null) {
  expect(element).not.toBeNull();
  expect(element?.className).toContain("rounded-xl");
  expect(element?.className).toContain("border-border");
  expect(element?.className).toContain("bg-card");
}

describe("admin surface chrome", () => {
  test("keeps Tailwind utilities on the shared surface class", () => {
    expect(ADMIN_SURFACE_CLASS).toContain("rounded-xl");
    expect(ADMIN_SURFACE_CLASS).toContain("border-border");
    expect(ADMIN_SURFACE_CLASS).toContain("bg-card");
  });

  test("StatCard keeps bordered card chrome", () => {
    const { container } = render(
      <StatCard title="Active Vouchers" value={12} icon="active" />,
    );

    expectCardChrome(container.firstElementChild);
  });

  test("AdminSurface keeps bordered card chrome", () => {
    const { container } = render(<AdminSurface>Panel</AdminSurface>);

    expectCardChrome(container.firstElementChild);
  });

  test("chart and purchase wrappers keep bordered card chrome", () => {
    const recent = render(<RecentOrders orders={[]} />);
    expectCardChrome(recent.container.firstElementChild);

    const summary = render(
      <VoucherSummary
        stats={{ active: 1, redeemed: 2, expired: 0 }}
        showReviews={false}
      />,
    );
    expectCardChrome(summary.container.firstElementChild?.firstElementChild ?? null);
  });

  test("dashboard skeleton KPI cards keep bordered card chrome", () => {
    const { container } = render(<AdminDashboardSkeleton />);
    const cards = container.querySelectorAll(".rounded-xl.border.border-border.bg-card");

    expect(cards.length).toBeGreaterThanOrEqual(6);
  });

  test("chart card source uses the shared surface chrome", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/admin/chart-card.tsx"),
      "utf8",
    );

    expect(source).toContain("ADMIN_SURFACE_CLASS");
  });
});

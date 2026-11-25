import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { BuyersClient } from "@/components/admin/buyers-client";
import { buildAdminPage } from "@/lib/actions/admin-pagination";
import type { AdminBuyer } from "@/lib/actions/buyers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/buyers",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

function buyer(overrides: Partial<AdminBuyer> = {}): AdminBuyer {
  return {
    phone: "6281234564471",
    customerName: "Rina Maharani",
    customerEmail: "rina@example.com",
    orderCount: 2,
    voucherCount: 2,
    lastOrderAt: "2026-11-20T04:00:00Z",
    otherNames: [],
    member: {
      id: MEMBER_ID,
      memberCode: "7KQ2X9",
      effectiveTier: 1,
    },
    ...overrides,
  };
}

describe("BuyersClient member badge", () => {
  test("shows a Member badge with the level and links to the member card", () => {
    render(
      <BuyersClient
        initialPage={buildAdminPage([buyer()], 1, 1)}
      />,
    );

    const badges = screen.getAllByRole("link", { name: "Buka kartu member, Bronze" });
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]).toHaveAttribute("href", `/admin/members?member=${MEMBER_ID}`);
    expect(screen.getAllByText("Member · Bronze").length).toBeGreaterThan(0);
  });

  test("hides the badge when the buyer is not a member", () => {
    render(
      <BuyersClient
        initialPage={buildAdminPage([buyer({ member: null, customerName: "Budi Santoso" })], 1, 1)}
      />,
    );
    expect(screen.queryByRole("link", { name: /Buka kartu member/ })).not.toBeInTheDocument();
  });
});

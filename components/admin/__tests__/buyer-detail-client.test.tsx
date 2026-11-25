import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { BuyerDetailClient } from "@/components/admin/buyer-detail-client";
import type { AdminBuyer } from "@/lib/actions/buyers";
import type { OrderWithVoucherItems } from "@/lib/database.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: ({
    title,
    titleSlot,
  }: {
    title: string;
    titleSlot?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {titleSlot}
    </header>
  ),
}));

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

function buyer(overrides: Partial<AdminBuyer> = {}): AdminBuyer {
  return {
    phone: "6281234564471",
    customerName: "Rina Maharani",
    customerEmail: "rina@example.com",
    orderCount: 1,
    voucherCount: 1,
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

function order(): OrderWithVoucherItems {
  return {
    id: "ord-1",
    payment_order_id: "PAY-1001",
    created_at: "2026-11-20T04:00:00Z",
    total_amount: 350000,
    payment_status: "paid",
    customer_name: "Rina Maharani",
    customer_email: "rina@example.com",
    customer_phone: "6281234564471",
    payment_provider: "stripe",
    vouchers: { id: "v1", code: "KLN-ABC", services: { name: "Massage", duration: 60 } },
    order_items: [],
  } as unknown as OrderWithVoucherItems;
}

describe("BuyerDetailClient member badge", () => {
  test("shows the same Member badge and level as the Pembeli list", () => {
    render(<BuyerDetailClient buyer={buyer()} orders={[order()]} />);
    const badge = screen.getByRole("link", { name: "Buka kartu member, Bronze" });
    expect(badge).toHaveAttribute("href", `/admin/members?member=${MEMBER_ID}`);
    expect(screen.getByText("Member · Bronze")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rina Maharani" })).toBeInTheDocument();
  });

  test("shows a plain Member badge when the level is still Member", () => {
    render(
      <BuyerDetailClient
        buyer={buyer({ member: { id: MEMBER_ID, memberCode: "7KQ2X9", effectiveTier: 0 } })}
        orders={[order()]}
      />,
    );
    expect(screen.getByRole("link", { name: "Buka kartu member, Member" })).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.queryByText("Member · Bronze")).not.toBeInTheDocument();
  });

  test("hides the badge when the buyer is not a member", () => {
    render(
      <BuyerDetailClient
        buyer={buyer({ member: null, customerName: "Budi Santoso" })}
        orders={[order()]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Budi Santoso" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Buka kartu member/ })).not.toBeInTheDocument();
  });

  test("shows contact facts, last visit, and a WhatsApp action in one header", () => {
    render(<BuyerDetailClient buyer={buyer()} orders={[order()]} />);
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("rina@example.com")).toBeInTheDocument();
    expect(screen.getByText("20 Nov 2026")).toBeInTheDocument();
    const wa = screen.getByRole("link", { name: "Buka WhatsApp" });
    expect(wa).toHaveAttribute("href", expect.stringContaining("https://wa.me/6281234564471?text="));
    expect(screen.getByText("Pembelian")).toBeInTheDocument();
    expect(screen.getByText("Voucher")).toBeInTheDocument();
  });
});

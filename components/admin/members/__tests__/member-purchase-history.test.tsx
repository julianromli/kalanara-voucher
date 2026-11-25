import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { getBuyerOrders } = vi.hoisted(() => ({
  getBuyerOrders: vi.fn(),
}));

vi.mock("@/lib/actions/buyers", () => ({
  getBuyerOrders,
}));

import { MemberPurchaseHistory } from "@/components/admin/members/member-purchase-history";

describe("MemberPurchaseHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows an empty state when the member has never bought a voucher online", async () => {
    getBuyerOrders.mockResolvedValueOnce([]);
    render(<MemberPurchaseHistory phone="6281234564471" />);
    expect(screen.getByText("Riwayat beli voucher")).toBeInTheDocument();
    expect(await screen.findByText("Belum pernah beli voucher online.")).toBeInTheDocument();
    expect(getBuyerOrders).toHaveBeenCalledWith("6281234564471");
  });

  test("lists purchases made by this phone, not as a recipient", async () => {
    getBuyerOrders.mockResolvedValueOnce([
      {
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
        order_items: [
          {
            id: "item-1",
            voucher_id: "v1",
            recipient_name: "Dinda",
            delivery_method: "whatsapp",
            send_to: "6282212347221",
            sort_order: 0,
            created_at: "2026-11-20T04:00:00Z",
            unit_price: 350000,
            services: { name: "Massage" },
            vouchers: { code: "KLN-ABC" },
          },
        ],
      },
    ]);
    render(<MemberPurchaseHistory phone="6281234564471" />);
    expect(await screen.findByRole("link", { name: "PAY-1001" })).toHaveAttribute(
      "href",
      "/admin/purchases?order=ord-1",
    );
    expect(screen.getByText(/KLN-ABC/)).toBeInTheDocument();
    await waitFor(() => expect(getBuyerOrders).toHaveBeenCalledTimes(1));
  });
});

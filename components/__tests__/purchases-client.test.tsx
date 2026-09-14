import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PurchasesClient } from "@/components/admin/purchases-client";
import { ToastProvider } from "@/context/ToastContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin/purchases",
  useSearchParams: () =>
    new URLSearchParams("query=tidak-ada&status=COMPLETED"),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}));

vi.mock("@/lib/actions/orders", () => ({
  deleteOrderHard: vi.fn(),
  clearAllOrdersHard: vi.fn(),
}));

describe("PurchasesClient", () => {
  test("uses the unfiltered total for Clear All while the filtered page is empty", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <PurchasesClient
          initialPage={{
            rows: [],
            page: 1,
            pageSize: 25,
            totalCount: 0,
            totalPages: 1,
          }}
          initialTotalCount={41}
          initialQuery="tidak-ada"
          initialFilter="COMPLETED"
          canUpdatePaymentStatus
          canDeletePurchases
        />
      </ToastProvider>,
    );

    const clearAll = screen.getByRole("button", {
      name: "Clear All Purchases",
    });
    expect(clearAll).toBeEnabled();

    await user.click(clearAll);

    expect(screen.getByText(/41 purchases will be removed/)).toBeInTheDocument();
    expect(screen.getByText("0 pembelian")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PurchasesClient } from "@/components/admin/purchases-client";
import { ToastProvider } from "@/context/ToastContext";
import type { OrderWithVoucherItems } from "@/lib/database.types";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  search: "query=tidak-ada&status=COMPLETED",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  usePathname: () => "/admin/purchases",
  useSearchParams: () => new URLSearchParams(mocks.search),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "query=tidak-ada&status=COMPLETED";
    mocks.replace.mockImplementation((url: string) => {
      mocks.search = url.split("?")[1] ?? "";
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  test("locks pagination during completion and leaves an emptied pending last page", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: { ok: boolean }) => void;
    const fetchPromise = new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => fetchPromise));
    mocks.search = "status=PENDING&page=2";

    const pendingOrder = {
      id: "order-1",
      customer_name: "Pelanggan",
      customer_email: "pelanggan@example.com",
      customer_phone: "08123456789",
      payment_order_id: "PAY-1",
      payment_status: "PENDING",
      payment_provider: "scalev",
      payment_type: null,
      scalev_payment_method: null,
      scalev_order_id: null,
      scalev_pg_reference_id: null,
      payment_transaction_id: null,
      payment_transaction_time: null,
      total_amount: 250000,
      created_at: "2026-09-15T00:00:00.000Z",
      order_items: [],
      vouchers: null,
    } as unknown as OrderWithVoucherItems;

    render(
      <ToastProvider>
        <PurchasesClient
          initialPage={{
            rows: [pendingOrder],
            page: 2,
            pageSize: 25,
            totalCount: 26,
            totalPages: 2,
          }}
          initialTotalCount={26}
          canUpdatePaymentStatus
          canDeletePurchases
        />
      </ToastProvider>
    );

    await user.click(
      screen.getByRole("button", { name: "Open actions for PAY-1" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Complete" }));

    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();

    resolveFetch({ ok: true });

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/admin/purchases?status=PENDING",
        { scroll: false }
      );
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

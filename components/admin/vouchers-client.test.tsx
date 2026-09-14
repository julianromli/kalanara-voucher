import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { VouchersClient } from "@/components/admin/vouchers-client";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import {
  deleteVoucher,
  extendVoucher,
  redeemVoucher,
  type VoucherAdminListRow,
  voidVoucher,
} from "@/lib/actions/vouchers";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/admin/vouchers",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: "admin@kalanaraspa.com", role: "SUPER_ADMIN" },
  }),
}));

vi.mock("@/components/admin/dashboard-header", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}));

vi.mock("@/lib/actions/vouchers", () => ({
  redeemVoucher: vi.fn(),
  extendVoucher: vi.fn(),
  voidVoucher: vi.fn(),
  deleteVoucher: vi.fn(),
}));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || "mouse";
  }
}

window.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof window.IntersectionObserver;
window.ResizeObserver =
  MockResizeObserver as unknown as typeof window.ResizeObserver;
window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

const serviceRow = {
  name: "Balinese Massage",
  duration: 90,
} as const;

const initialVouchers: VoucherAdminListRow[] = [
  {
    id: "voucher-1",
    code: "KSP-2026-ACTIVE01",
    recipient_name: "Ayu",
    recipient_email: "ayu@example.com",
    expiry_date: "2026-12-31T00:00:00.000Z",
    is_redeemed: false,
    amount: 550000,
    services: serviceRow,
  },
  {
    id: "voucher-2",
    code: "KSP-2026-USED0002",
    recipient_name: "Citra",
    recipient_email: "citra@example.com",
    expiry_date: "2026-12-31T00:00:00.000Z",
    is_redeemed: true,
    amount: 550000,
    services: serviceRow,
  },
];

function renderComponent() {
  const initialPage: AdminPage<VoucherAdminListRow> = {
    rows: initialVouchers,
    page: 1,
    pageSize: 25,
    totalCount: initialVouchers.length,
    totalPages: 1,
  };

  return render(
    <ToastProvider>
      <VouchersClient
        initialPage={initialPage}
        initialSummary={{ active: 123, redeemed: 89, expired: 52 }}
        initialQuery=""
        initialFilter="ALL"
      />
    </ToastProvider>,
  );
}

describe("VouchersClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redeemVoucher).mockResolvedValue({
      success: true,
      message: "Voucher redeemed",
    });
    vi.mocked(extendVoucher).mockResolvedValue(true);
    vi.mocked(voidVoucher).mockResolvedValue(true);
  });

  it("renders global voucher summary counts supplied by the server", () => {
    renderComponent();

    expect(screen.getByText("264")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
  });

  it("deletes a voucher from the dropdown menu after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteVoucher).mockResolvedValue({
      success: true,
      message: "Voucher berhasil dihapus permanen.",
      detachedOrderCount: 1,
      deletedReviewCount: 0,
      deletedVoucherCount: 1,
    });

    renderComponent();

    await user.click(
      screen.getByRole("button", {
        name: "Open actions for KSP-2026-ACTIVE01",
      }),
    );

    expect(
      screen.getByRole("menuitem", { name: "Redeem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(
      screen.getByRole("alertdialog", { name: "Delete voucher permanently?" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete Permanently" }),
    );

    await waitFor(() => {
      expect(deleteVoucher).toHaveBeenCalledWith("voucher-1");
    });

    await waitFor(() => {
      expect(screen.queryByText("KSP-2026-ACTIVE01")).not.toBeInTheDocument();
    });

    expect(
      await screen.findByText("Voucher berhasil dihapus permanen."),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("restores the voucher row when permanent delete fails", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteVoucher).mockResolvedValue({
      success: false,
      message: "Voucher tidak ditemukan.",
      detachedOrderCount: 0,
      deletedReviewCount: 0,
      deletedVoucherCount: 0,
    });

    renderComponent();

    await user.click(
      screen.getByRole("button", {
        name: "Open actions for KSP-2026-ACTIVE01",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      screen.getByRole("button", { name: "Delete Permanently" }),
    );

    await waitFor(() => {
      expect(deleteVoucher).toHaveBeenCalledWith("voucher-1");
    });

    expect(
      await screen.findByText("Voucher tidak ditemukan."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("KSP-2026-ACTIVE01").length).toBeGreaterThan(0);
  });
});

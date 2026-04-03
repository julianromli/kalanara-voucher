import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { VouchersClient } from "@/components/admin/vouchers-client";
import type { VoucherWithService } from "@/lib/database.types";
import {
  deleteVoucher,
  extendVoucher,
  redeemVoucher,
  voidVoucher,
} from "@/lib/actions/vouchers";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
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
  id: "service-1",
  name: "Balinese Massage",
  description: "Relaxing treatment",
  duration: 90,
  price: 550000,
  category: "MASSAGE",
  category_id: null,
  image_url: null,
  is_active: true,
  scalev_product_id: null,
  scalev_variant_id: null,
  scalev_variant_unique_id: null,
  scalev_sync_status: null,
  scalev_last_synced_at: null,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
} as const;

const initialVouchers: VoucherWithService[] = [
  {
    id: "voucher-1",
    code: "KSP-2026-ACTIVE01",
    source_order_id: "order-1",
    service_id: "service-1",
    recipient_name: "Ayu",
    recipient_email: "ayu@example.com",
    sender_name: "Budi",
    sender_message: "Selamat menikmati",
    purchase_date: "2026-04-01T00:00:00.000Z",
    expiry_date: "2026-12-31T00:00:00.000Z",
    is_redeemed: false,
    redeemed_at: null,
    amount: 550000,
    created_at: "2026-04-01T00:00:00.000Z",
    services: serviceRow,
  },
  {
    id: "voucher-2",
    code: "KSP-2026-USED0002",
    source_order_id: "order-2",
    service_id: "service-1",
    recipient_name: "Citra",
    recipient_email: "citra@example.com",
    sender_name: "Dewi",
    sender_message: null,
    purchase_date: "2026-04-01T00:00:00.000Z",
    expiry_date: "2026-12-31T00:00:00.000Z",
    is_redeemed: true,
    redeemed_at: "2026-04-02T00:00:00.000Z",
    amount: 550000,
    created_at: "2026-04-01T00:00:00.000Z",
    services: serviceRow,
  },
];

function renderComponent() {
  return render(
    <ToastProvider>
      <VouchersClient initialVouchers={initialVouchers} />
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

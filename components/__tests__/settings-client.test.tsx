import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { SettingsClient } from "@/components/admin/settings-client";
import { VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY } from "@/lib/payment/voucher-expiry";

const {
  refreshMock,
  updateSiteSettingMock,
} = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  updateSiteSettingMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
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

vi.mock("@/lib/actions/crm", () => ({
  updateSiteSetting: updateSiteSettingMock,
}));

const initialSettings = {
  businessHours: { start: "09:00", end: "18:00" },
  emailTemplates: { confirmation: "Default confirmation template" },
  voucherExpiration: 90,
  paymentMethods: ["BANK_TRANSFER", "E_WALLET"],
};

function renderSettings(
  props?: Partial<Parameters<typeof SettingsClient>[0]>
) {
  return render(
    <ToastProvider>
      <SettingsClient
        initialSettings={initialSettings}
        {...props}
      />
    </ToastProvider>
  );
}

describe("SettingsClient voucher expiration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSiteSettingMock.mockResolvedValue({
      key: VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
      value: "60",
    });
  });

  test("loads the persisted expiration days", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Vouchers" }));

    expect(screen.getByLabelText("Default Expiration (Days)")).toHaveValue(90);
    expect(
      screen.getByText(/Voucher baru kedaluwarsa setelah jumlah hari ini/)
    ).toBeInTheDocument();
  });

  test("saves voucher expiration through updateSiteSetting", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Vouchers" }));
    fireEvent.change(screen.getByLabelText("Default Expiration (Days)"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateSiteSettingMock).toHaveBeenCalledWith(
        VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
        "60"
      );
    });
    expect(refreshMock).toHaveBeenCalled();
    expect(
      await screen.findByText("Masa berlaku voucher berhasil disimpan.")
    ).toBeInTheDocument();
  });

  test("does not fake-save invalid expiration days", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Vouchers" }));
    fireEvent.change(screen.getByLabelText("Default Expiration (Days)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.getByText("Gagal menyimpan masa berlaku voucher.")
      ).toBeInTheDocument();
    });
    expect(updateSiteSettingMock).not.toHaveBeenCalled();
  });

  test("rejects fractional expiration days instead of truncating them", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Vouchers" }));
    fireEvent.change(screen.getByLabelText("Default Expiration (Days)"), {
      target: { value: "90.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.getByText("Gagal menyimpan masa berlaku voucher.")
      ).toBeInTheDocument();
    });
    expect(updateSiteSettingMock).not.toHaveBeenCalled();
  });

  test("disables save when the expiration setting failed to load", () => {
    renderSettings({ voucherExpirationLoadError: true });

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    expect(saveButton).toBeDisabled();
    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      "Gagal memuat masa berlaku voucher. Penyimpanan dinonaktifkan agar nilai tersimpan tidak tertimpa."
    );

    fireEvent.click(saveButton);
    expect(updateSiteSettingMock).not.toHaveBeenCalled();
  });
});

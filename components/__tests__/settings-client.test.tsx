import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ToastProvider } from "@/context/ToastContext";
import { SettingsClient } from "@/components/admin/settings-client";
import { VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY } from "@/lib/payment/voucher-expiry";

const refresh = vi.fn();
const {
  updateSiteSettingMock,
} = vi.hoisted(() => ({
  updateSiteSettingMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
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

function renderSettings() {
  return render(
    <ToastProvider>
      <SettingsClient initialSettings={initialSettings} />
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
    expect(refresh).toHaveBeenCalled();
    expect(
      await screen.findByText("Voucher expiration saved successfully.")
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
        screen.getByText("Failed to save voucher expiration.")
      ).toBeInTheDocument();
    });
    expect(updateSiteSettingMock).not.toHaveBeenCalled();
  });
});

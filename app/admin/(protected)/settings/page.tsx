import { SettingsClient } from "@/components/admin/settings-client";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { getSiteSetting } from "@/lib/actions/crm";
import {
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
  resolveLoadedVoucherExpirationDays,
} from "@/lib/payment/voucher-expiry";

const mockSettings = {
  businessHours: { start: "09:00", end: "18:00" },
  emailTemplates: { confirmation: "Default confirmation template" },
  paymentMethods: ["BANK_TRANSFER", "E_WALLET"],
};

export default async function AdminSettingsPage() {
  await requireAdminRouteAccess("/admin/settings");

  let settingValue: string | undefined;
  let loadFailed = false;

  try {
    const voucherExpirationSetting = await getSiteSetting(
      VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY
    );
    settingValue = voucherExpirationSetting?.value;
  } catch {
    loadFailed = true;
  }

  const { days: voucherExpiration, loadError: voucherExpirationLoadError } =
    resolveLoadedVoucherExpirationDays(settingValue, loadFailed);

  return (
    <SettingsClient
      initialSettings={{
        ...mockSettings,
        voucherExpiration,
      }}
      voucherExpirationLoadError={voucherExpirationLoadError}
    />
  );
}

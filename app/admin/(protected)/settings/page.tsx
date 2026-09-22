import { SettingsClient } from "@/components/admin/settings-client";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";
import { getSiteSetting } from "@/lib/actions/crm";
import {
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
  parseVoucherExpirationDays,
} from "@/lib/payment/voucher-expiry";

const mockSettings = {
  businessHours: { start: "09:00", end: "18:00" },
  emailTemplates: { confirmation: "Default confirmation template" },
  paymentMethods: ["BANK_TRANSFER", "E_WALLET"],
};

export default async function AdminSettingsPage() {
  await requireAdminRouteAccess("/admin/settings");

  const voucherExpirationSetting = await getSiteSetting(
    VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY
  );

  return (
    <SettingsClient
      initialSettings={{
        ...mockSettings,
        voucherExpiration: parseVoucherExpirationDays(
          voucherExpirationSetting?.value
        ),
      }}
    />
  );
}

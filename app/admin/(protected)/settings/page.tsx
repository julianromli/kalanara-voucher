import { SettingsClient } from "@/components/admin/settings-client";
import { requireAdminRouteAccess } from "@/lib/auth/admin-rbac-server";

const mockSettings = {
  businessHours: { start: "09:00", end: "18:00" },
  emailTemplates: { confirmation: "Default confirmation template" },
  voucherExpiration: 30,
  paymentMethods: ["BANK_TRANSFER", "E_WALLET"],
};

export default async function AdminSettingsPage() {
  await requireAdminRouteAccess("/admin/settings");

  return <SettingsClient initialSettings={mockSettings} />;
}

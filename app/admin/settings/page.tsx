import { SettingsClient } from "@/components/admin/settings-client";

// TODO: Replace with actual settings fetch when backend is implemented
const mockSettings = {
  businessHours: { start: '09:00', end: '18:00' },
  emailTemplates: { confirmation: 'Default confirmation template' },
  voucherExpiration: 30,
  paymentMethods: ['BANK_TRANSFER', 'E_WALLET']
};

export default async function AdminSettingsPage() {
  return <SettingsClient initialSettings={mockSettings} />;
}

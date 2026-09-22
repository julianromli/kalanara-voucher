"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { AdminPageBody } from "@/components/admin/admin-page";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ClockIcon, MailIcon, CreditCardIcon, TicketIcon } from "@hugeicons/core-free-icons";
import { updateSiteSetting } from "@/lib/actions/crm";
import {
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
  VOUCHER_EXPIRATION_DAYS_MAX,
  VOUCHER_EXPIRATION_DAYS_MIN,
  normalizeVoucherExpirationDaysInput,
} from "@/lib/payment/voucher-expiry";

interface SettingsClientProps {
  initialSettings: {
    businessHours: { start: string; end: string };
    emailTemplates: { confirmation: string };
    voucherExpiration: number;
    paymentMethods: string[];
  };
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("business");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const days = normalizeVoucherExpirationDaysInput(
        settings.voucherExpiration
      );
      await updateSiteSetting(
        VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
        String(days)
      );
      setSettings((current) => ({
        ...current,
        voucherExpiration: days,
      }));
      router.refresh();
      showToast("Voucher expiration saved successfully.", "success");
    } catch {
      showToast("Failed to save voucher expiration.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Settings" showActions={false} />
      <AdminPageBody>
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Configure your spa business settings
            </p>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="w-full">
            <div role="tablist" aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("business")}
                className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "business"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === "business"}
              >
                Business Hours
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("email")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "email"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === "email"}
              >
                Email Templates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vouchers")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "vouchers"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === "vouchers"}
              >
                Vouchers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "payments"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === "payments"}
              >
                Payment Methods
              </button>
            </div>

            <div className="mt-6">
              {activeTab === "business" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HugeiconsIcon icon={ClockIcon} className="w-5 h-5" />
                      Business Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start-time">Opening Time</Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={settings.businessHours.start}
                          onChange={(e) => setSettings({
                            ...settings,
                            businessHours: { ...settings.businessHours, start: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-time">Closing Time</Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={settings.businessHours.end}
                          onChange={(e) => setSettings({
                            ...settings,
                            businessHours: { ...settings.businessHours, end: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === "email" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HugeiconsIcon icon={MailIcon} className="w-5 h-5" />
                      Email Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="confirmation-template">Confirmation Email Template</Label>
                      <Textarea
                        id="confirmation-template"
                        rows={6}
                        value={settings.emailTemplates.confirmation}
                        onChange={(e) => setSettings({
                          ...settings,
                          emailTemplates: { ...settings.emailTemplates, confirmation: e.target.value }
                        })}
                        placeholder="Enter email template content..."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === "vouchers" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HugeiconsIcon icon={TicketIcon} className="w-5 h-5" />
                      Voucher Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="expiration-days">Default Expiration (Days)</Label>
                      <Input
                        id="expiration-days"
                        type="number"
                        inputMode="numeric"
                        min={VOUCHER_EXPIRATION_DAYS_MIN}
                        max={VOUCHER_EXPIRATION_DAYS_MAX}
                        aria-describedby="expiration-days-help"
                        value={
                          Number.isFinite(settings.voucherExpiration)
                            ? settings.voucherExpiration
                            : ""
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            voucherExpiration:
                              e.target.value === ""
                                ? Number.NaN
                                : Number.parseInt(e.target.value, 10),
                          })
                        }
                      />
                      <p
                        id="expiration-days-help"
                        className="mt-2 text-sm text-muted-foreground"
                      >
                        New vouchers expire this many days after payment. Use a
                        whole number from {VOUCHER_EXPIRATION_DAYS_MIN} to{" "}
                        {VOUCHER_EXPIRATION_DAYS_MAX}.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === "payments" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HugeiconsIcon icon={CreditCardIcon} className="w-5 h-5" />
                      Payment Methods
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {settings.paymentMethods.map((method) => (
                        <div key={method} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={true}
                            className="rounded"
                          />
                          <Label>{method.replace('_', ' ')}</Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </AdminPageBody>
    </>
  );
}

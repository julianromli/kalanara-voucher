"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ClockIcon, MailIcon, CreditCardIcon, TicketIcon } from "@hugeicons/core-free-icons";

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

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // TODO: Implement actual settings save to backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showToast("Settings saved successfully", "success");
    } catch (error) {
      showToast("Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Settings" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">System Settings</h1>
              <p className="text-muted-foreground">Configure your spa business settings</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {/* Simple Tab Navigation */}
          <div className="w-full">
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("business")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "business"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Business Hours
              </button>
              <button
                onClick={() => setActiveTab("email")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "email"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Email Templates
              </button>
              <button
                onClick={() => setActiveTab("vouchers")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "vouchers"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Vouchers
              </button>
              <button
                onClick={() => setActiveTab("payments")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "payments"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
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
                        min="1"
                        max="365"
                        value={settings.voucherExpiration}
                        onChange={(e) => setSettings({
                          ...settings,
                          voucherExpiration: parseInt(e.target.value)
                        })}
                      />
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
      </div>
    </>
  );
}

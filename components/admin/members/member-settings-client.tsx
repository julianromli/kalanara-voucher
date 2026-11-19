"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  RewardSettingsForm,
  type RewardDraft,
} from "@/components/admin/members/reward-settings-form";
import { SignupQrPanel } from "@/components/admin/members/signup-qr-panel";

interface MemberSettingsClientProps {
  rewards: RewardDraft[];
  rewardLoadError: boolean;
  signupQr: {
    url: string;
    createdAt: string;
    monthCount: number;
    recent: Array<{ id: string; name: string; createdAt: string; stampCount: number }>;
  } | null;
}

export function MemberSettingsClient({
  rewards,
  rewardLoadError,
  signupQr,
}: MemberSettingsClientProps) {
  const [tab, setTab] = useState<"reward" | "qr">("reward");
  const tabs = [
    { id: "reward" as const, label: "Reward", panelId: "member-settings-reward" },
    { id: "qr" as const, label: "QR daftar sendiri", panelId: "member-settings-qr" },
  ];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight"
      ? (index + 1) % tabs.length
      : (index - 1 + tabs.length) % tabs.length;
    setTab(tabs[next].id);
    document.getElementById(`member-settings-tab-${tabs[next].id}`)?.focus();
  }

  return (
    <>
      <DashboardHeader title="Pengaturan member" showActions={false} />
      <AdminPageBody>
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/members" className="underline">
            Member
          </Link>
        </p>
        <div role="tablist" aria-label="Pengaturan member" className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              type="button"
              id={`member-settings-tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={item.panelId}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`shrink-0 rounded-t-md border-b-2 px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          id="member-settings-reward"
          role="tabpanel"
          aria-labelledby="member-settings-tab-reward"
          hidden={tab !== "reward"}
          className={tab === "reward" ? undefined : "hidden"}
        >
          <RewardSettingsForm initialRows={rewards} loadError={rewardLoadError} />
        </div>
        <div
          id="member-settings-qr"
          role="tabpanel"
          aria-labelledby="member-settings-tab-qr"
          hidden={tab !== "qr"}
          className={tab === "qr" ? undefined : "hidden"}
        >
          {signupQr ? (
            <SignupQrPanel {...signupQr} />
          ) : (
            <p className="text-sm text-destructive" role="alert">QR daftar sendiri gagal dimuat. Muat ulang halaman ini.</p>
          )}
        </div>
      </AdminPageBody>
    </>
  );
}

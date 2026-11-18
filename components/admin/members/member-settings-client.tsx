"use client";

import { useState } from "react";
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
          <button
            type="button"
            role="tab"
            aria-selected={tab === "reward"}
            onClick={() => setTab("reward")}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "reward" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Reward
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "qr"}
            onClick={() => setTab("qr")}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "qr" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            QR daftar sendiri
          </button>
        </div>
        {tab === "reward" ? (
          <RewardSettingsForm initialRows={rewards} loadError={rewardLoadError} />
        ) : signupQr ? (
          <SignupQrPanel {...signupQr} />
        ) : (
          <p className="text-sm text-destructive">QR daftar sendiri gagal dimuat.</p>
        )}
      </AdminPageBody>
    </>
  );
}

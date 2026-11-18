"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { claimReward } from "@/lib/actions/members";
import { firstName } from "@/lib/membership/format";

interface ClaimRewardDialogProps {
  open: boolean;
  memberId: string;
  memberName: string;
  milestone: number;
  rewardName: string;
  stampCount: number;
  services: Array<{ id: string; name: string }>;
  servicesError?: boolean;
  onOpenChange: (open: boolean) => void;
  onClaimed: (claimId: string, rewardName: string) => void;
}

export function ClaimRewardDialog({
  open,
  memberId,
  memberName,
  milestone,
  rewardName,
  stampCount,
  services,
  servicesError = false,
  onOpenChange,
  onClaimed,
}: ClaimRewardDialogProps) {
  const [serviceName, setServiceName] = useState(services[0]?.name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Klaim {rewardName.toLowerCase()} buat {firstName(memberName)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Reward {milestone} stamp. Stamp {firstName(memberName)} tetap {stampCount}, nggak berkurang. Tiap reward cuma bisa diklaim sekali.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {servicesError ? (
          <p className="text-sm text-destructive" role="alert">
            Daftar treatment gagal dimuat. Muat ulang halaman, lalu klaim lagi.
          </p>
        ) : services.length === 0 ? (
          <p className="text-sm text-destructive" role="alert">
            Belum ada treatment aktif. Klaim belum bisa dilanjut.
          </p>
        ) : (
          <label className="space-y-1.5 text-sm" htmlFor="claim-service">
            Treatment yang dipakai
            <select
              id="claim-service"
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border bg-background px-3"
            >
              {services.map((service) => (
                <option key={service.id} value={service.name}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          Dicatat di riwayat kunjungan. Nggak nambah stamp.
        </p>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <Button
            type="button"
            disabled={pending || !serviceName}
            onClick={() => {
              setPending(true);
              setError(null);
              void claimReward({ memberId, milestone, serviceName }).then((result) => {
                setPending(false);
                if (result.status === "ok" && result.claimId) {
                  onClaimed(result.claimId, result.rewardName || rewardName);
                  onOpenChange(false);
                  return;
                }
                setError(
                  result.status === "already_claimed"
                    ? "Reward ini udah diklaim."
                    : result.status === "not_configured"
                      ? "Reward ini belum diatur. Tutup dialog ini, lalu cek daftar reward."
                      : result.status === "not_reached"
                        ? "Stamp-nya belum sampai milestone ini."
                        : "Klaim belum tersimpan. Koneksi putus.",
                );
              }).catch(() => {
                setPending(false);
                setError("Klaim belum tersimpan. Koneksi putus.");
              });
            }}
          >
            Klaim reward
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMemberDate, formatMemberTime, firstName } from "@/lib/membership/format";

interface AddStampBarProps {
  services: Array<{ id: string; name: string }>;
  serviceId: string;
  onServiceChange: (serviceId: string) => void;
  disabledReason?: string | null;
  justAdded: boolean;
  confirm: { serviceName: string; createdAt: string; memberName: string } | null;
  error: boolean;
  pending: boolean;
  onAdd: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onRetry: () => void;
  hasStampToday: boolean;
}

export function AddStampBar({
  services,
  serviceId,
  onServiceChange,
  disabledReason,
  justAdded,
  confirm,
  error,
  pending,
  onAdd,
  onConfirm,
  onCancelConfirm,
  onRetry,
  hasStampToday,
}: AddStampBarProps) {
  return (
    <section className="rounded-xl border bg-muted/30 p-4">
      <p className="text-sm font-medium">Treatment walk-in hari ini</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="stamp-service">
          Treatment walk-in hari ini
        </label>
        <select
          id="stamp-service"
          value={serviceId}
          onChange={(event) => onServiceChange(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        {justAdded ? (
          <p className="inline-flex h-9 items-center gap-2 rounded-lg bg-background px-3 text-sm">
            <Check className="size-4 text-success" />
            Udah dapat stamp hari ini
          </p>
        ) : (
          <Button type="button" onClick={onAdd} disabled={Boolean(disabledReason) || pending || services.length === 0}>
            <Plus className="size-4" />
            Tambah stamp
          </Button>
        )}
      </div>
      {disabledReason ? (
        <p className="mt-3 text-sm text-muted-foreground">{disabledReason}</p>
      ) : null}
      {confirm ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
          <p>
            {firstName(confirm.memberName)} udah dapat stamp hari ini jam{" "}
            {formatMemberTime(confirm.createdAt)} ({confirm.serviceName}). Yakin tambah lagi?
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onCancelConfirm}>
              Batal
            </Button>
            <Button type="button" size="sm" onClick={onConfirm} disabled={pending}>
              Tetap tambah
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-destructive">
          <p>Stamp belum tersimpan. Koneksi putus.</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Coba lagi
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {hasStampToday
            ? "1 stamp per kunjungan. Salah input? Pakai Batalkan di notifikasi."
            : "Cuma kunjungan walk-in. Kunjungan pakai voucher dari website nggak dapat stamp."}
        </p>
      )}
    </section>
  );
}

export function cappedReason(resetOn: string): string {
  return `Stamp udah maksimal 30. Reset di ${formatMemberDate(resetOn)}.`;
}

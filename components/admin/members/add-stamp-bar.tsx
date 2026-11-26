"use client";

import { Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMemberDate, formatMemberTime, firstName } from "@/lib/membership/format";

interface AddStampBarProps {
  services: Array<{ id: string; name: string }>;
  serviceId: string;
  onServiceChange: (serviceId: string) => void;
  disabledReason?: string | null;
  justAdded: boolean;
  confirm: { serviceName: string; createdAt: string; memberName: string } | null;
  /** Shown with Coba lagi; null hides it. */
  error: string | null;
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
      <label className="text-sm font-medium" htmlFor="stamp-service">
        Treatment walk-in hari ini
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={serviceId || undefined}
          onValueChange={onServiceChange}
          disabled={services.length === 0}
        >
          <SelectTrigger
            id="stamp-service"
            className="h-11 min-h-11 w-full min-w-0 flex-1 rounded-md text-base"
          >
            <SelectValue placeholder="Pilih treatment" />
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="max-w-[var(--radix-select-trigger-width)]">
            {services.map((service) => (
              <SelectItem
                key={service.id}
                value={service.id}
                className="min-h-11 items-start whitespace-normal py-2 text-left text-base leading-snug [&>span:last-child]:block [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words"
              >
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {justAdded ? (
          <p className="inline-flex h-11 items-center gap-2 rounded-lg bg-background px-3 text-sm" role="status">
            <Check className="size-4 text-success" aria-hidden="true" />
            Udah dapat stamp hari ini
          </p>
        ) : (
          <Button
            type="button"
            className="h-11 shrink-0"
            onClick={onAdd}
            disabled={Boolean(disabledReason) || pending || services.length === 0}
          >
            <Plus className="size-4" aria-hidden="true" />
            {pending ? "Mencatat…" : "Tambah stamp"}
          </Button>
        )}
      </div>
      {disabledReason ? (
        <p className="mt-3 text-sm text-muted-foreground">{disabledReason}</p>
      ) : null}
      {confirm ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm" role="alert">
          <p>
            {firstName(confirm.memberName)} udah dapat stamp hari ini jam{" "}
            {formatMemberTime(confirm.createdAt)} ({confirm.serviceName}). Yakin tambah lagi?
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onCancelConfirm}>
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={pending || Boolean(disabledReason) || services.length === 0}
            >
              Tetap tambah
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-destructive" role="alert">
          <p>{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={pending || Boolean(disabledReason) || services.length === 0}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
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

export const STAMP_NETWORK_ERROR = "Stamp belum tersimpan. Koneksi putus.";
export const STAMP_SERVER_ERROR = "Stamp belum tersimpan. Server lagi bermasalah. Coba lagi sebentar lagi.";

/** A thrown server action is a network failure only when fetch itself failed or the device is offline. */
export function isNetworkFailure(error: unknown): boolean {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return offline || error instanceof TypeError;
}

export function stampThrownMessage(error: unknown): string {
  return isNetworkFailure(error) ? STAMP_NETWORK_ERROR : STAMP_SERVER_ERROR;
}

/** The server answered, so the connection is fine; say what it refused. */
export function stampFailureMessage(status: string): string {
  if (status === "invalid_service") {
    return "Stamp belum tersimpan. Treatment ini udah nggak aktif. Pilih treatment lain.";
  }
  if (status === "invalid") {
    return "Stamp belum tersimpan. Data member atau treatment nggak valid. Muat ulang halaman, lalu coba lagi.";
  }
  return STAMP_SERVER_ERROR;
}

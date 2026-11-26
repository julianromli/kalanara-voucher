"use client";

import { useEffect, useRef, useState } from "react";
import { isNetworkFailure } from "@/components/admin/members/add-stamp-bar";
import { Button } from "@/components/ui/button";
import { DatePicker, preventCloseOnDatePickerLayer } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addPastStamp,
  correctStampDate,
  correctStampService,
  correctVoidStamp,
} from "@/lib/actions/members";
import { formatMemberDate } from "@/lib/membership/format";
import {
  STAMP_REASON_MAX,
  addStampBounds,
  claimWarning,
  isStampDateAllowed,
  isoToLocalDate,
  levelChangeNote,
  localDateToISO,
  periodForDate,
  periodLabel,
  stampCorrectionMessage,
  stampDateBounds,
  type KeptClaim,
  type StampHistory,
  type StampHistoryStamp,
} from "@/lib/membership/stamp-corrections";

export type StampCorrectionMode = "service" | "date" | "void" | "add";

interface StampCorrectionDialogProps {
  open: boolean;
  mode: StampCorrectionMode;
  memberId: string;
  stamp: StampHistoryStamp | null;
  services: Array<{ id: string; name: string }>;
  history: Pick<StampHistory, "origin" | "cycleStart" | "resetOn" | "today" | "periods">;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}

type Pending =
  | { kind: "same_day"; serviceName: string }
  | { kind: "claimed"; claims: KeptClaim[]; countAfter: number | null; pastPeriod: boolean }
  | null;

const TITLES: Record<StampCorrectionMode, string> = {
  service: "Ganti treatment",
  date: "Ganti tanggal kunjungan",
  void: "Hapus stamp",
  add: "Tambah stamp lama",
};

export function StampCorrectionDialog({
  open,
  mode,
  memberId,
  stamp,
  services,
  history,
  onOpenChange,
  onDone,
}: StampCorrectionDialogProps) {
  const [serviceId, setServiceId] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [pending, setPending] = useState(false);
  const [syncKey, setSyncKey] = useState("");
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  // The stamp's own period; a new stamp may go in any period from sign-up to today.
  const stampPeriod = stamp
    ? history.periods.find((item) => item.cycleStart === stamp.cycleStart) ??
      (stamp.cycleStart === history.cycleStart
        ? { cycleStart: history.cycleStart, resetOn: history.resetOn }
        : null)
    : null;
  const bounds =
    mode === "add" || !stampPeriod
      ? addStampBounds(history)
      : stampDateBounds({ ...stampPeriod, today: history.today, origin: history.origin });
  const period = stampPeriod ?? { cycleStart: history.cycleStart, resetOn: history.resetOn };

  const key = `${open}-${mode}-${stamp?.id ?? "new"}`;
  if (key !== syncKey) {
    setSyncKey(key);
    if (open) {
      const matched = stamp?.serviceId && services.some((service) => service.id === stamp.serviceId)
        ? stamp.serviceId
        : "";
      setServiceId(mode === "add" ? services[0]?.id ?? "" : matched);
      setVisitDate(mode === "add" ? bounds.max : stamp?.visitDate ?? "");
      setReason("");
      setError(null);
      setDateError(null);
      setConfirm(null);
      setPending(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const needsService = mode === "service" || mode === "add";
  const needsDate = mode === "date" || mode === "add";
  const destructive = mode === "void";

  async function submit(confirmed: boolean) {
    if (needsDate && !isStampDateAllowed(visitDate, bounds)) {
      setDateError(
        `Pilih tanggal ${formatMemberDate(bounds.min)} sampai ${formatMemberDate(bounds.max)}.`,
      );
      return;
    }
    if (needsService && !serviceId) {
      setError("Pilih treatment dulu.");
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPending(true);
    setError(null);
    const trimmed = reason.trim() || undefined;
    try {
      let status: string;
      let message = "";
      let context: { cycleStart?: string | null; resetOn?: string | null } = period;
      if (mode === "void" && stamp) {
        const result = await correctVoidStamp({
          stampId: stamp.id,
          reason: trimmed,
          confirmClaimed: confirmed,
        });
        status = result.status;
        if (status === "needs_confirm_claimed") {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setPending(false);
          setConfirm({
            kind: "claimed",
            claims: ("claims" in result && result.claims) || [],
            countAfter: ("count" in result ? result.count : null) ?? null,
            pastPeriod: "pastPeriod" in result && result.pastPeriod === true,
          });
          return;
        }
        message = `Stamp ${stamp.serviceName} dihapus.`;
        if ("tierBefore" in result) {
          message = `${message} ${levelChangeNote(result.tierBefore, result.tierAfter)}`.trim();
        }
      } else if (mode === "service" && stamp) {
        const result = await correctStampService({ stampId: stamp.id, serviceId, reason: trimmed });
        status = result.status;
        message = `Treatment diganti jadi ${("serviceName" in result && result.serviceName) || "treatment baru"}.`;
      } else if (mode === "date" && stamp) {
        const result = await correctStampDate({
          stampId: stamp.id,
          visitDate,
          reason: trimmed,
          confirmSameDay: confirmed,
        });
        status = result.status;
        if ("cycleStart" in result) context = result;
        if (status === "needs_confirm") {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setPending(false);
          setConfirm({ kind: "same_day", serviceName: ("serviceName" in result && result.serviceName) || "treatment" });
          return;
        }
        message = `Tanggal kunjungan diganti jadi ${formatMemberDate(visitDate)}.`;
      } else {
        const result = await addPastStamp({
          memberId,
          serviceId,
          visitDate,
          reason: trimmed,
          confirmSameDay: confirmed,
        });
        status = result.status;
        if ("cycleStart" in result) context = result;
        if (status === "needs_confirm") {
          if (!mountedRef.current || requestId !== requestRef.current) return;
          setPending(false);
          setConfirm({ kind: "same_day", serviceName: ("serviceName" in result && result.serviceName) || "treatment" });
          return;
        }
        const count = "count" in result ? result.count : null;
        const past = "pastPeriod" in result && result.pastPeriod === true;
        message = past
          ? `Stamp lama tercatat di periode lalu (${count ?? "?"} stamp di periode itu).`
          : count
            ? `Stamp lama tercatat. Sekarang ${count} stamp.`
            : "Stamp lama tercatat.";
        if ("tierBefore" in result) {
          message = `${message} ${levelChangeNote(result.tierBefore, result.tierAfter)}`.trim();
        }
      }
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setPending(false);
      if (status === "ok") {
        onDone(message);
        onOpenChange(false);
        return;
      }
      setConfirm(null);
      setError(stampCorrectionMessage(status, context));
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setPending(false);
      setError(stampCorrectionMessage(isNetworkFailure(caught) ? "network" : "error"));
    }
  }

  const datePeriod = mode === "add" && visitDate ? periodForDate(history.periods, visitDate) : null;
  const inPastPeriod =
    mode === "add"
      ? datePeriod != null && !datePeriod.current
      : stamp != null && stamp.cycleStart !== history.cycleStart;
  const dateHint =
    mode === "add"
      ? datePeriod
        ? `Masuk periode ${datePeriod.current ? "sekarang" : "lalu"}: ${periodLabel(datePeriod)}.`
        : `Pilih tanggal ${formatMemberDate(bounds.min)} sampai ${formatMemberDate(bounds.max)}.`
      : `Periode stamp ini: ${periodLabel(period)}.`;
  const minDate = isoToLocalDate(bounds.min);
  const maxDate = isoToLocalDate(bounds.max);
  const confirmLabel =
    confirm?.kind === "claimed"
      ? "Tetap hapus"
      : confirm?.kind === "same_day"
        ? "Tetap simpan"
        : destructive
          ? "Hapus stamp"
          : mode === "add"
            ? "Tambah stamp"
            : "Simpan";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-[460px]"
        onPointerDownOutside={preventCloseOnDatePickerLayer}
        onFocusOutside={preventCloseOnDatePickerLayer}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(confirm != null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{TITLES[mode]}</DialogTitle>
            <DialogDescription>
              {stamp
                ? `${stamp.serviceName} · ${formatMemberDate(stamp.visitDate)}`
                : `Buat kunjungan yang kelupaan dicatat, ${formatMemberDate(bounds.min)} sampai ${formatMemberDate(bounds.max)}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {inPastPeriod ? (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-pretty">
                {mode === "void" || mode === "add"
                  ? "Ini periode lalu. Reward periode itu nggak bisa diklaim lagi, tapi level yang kebawa ke periode sekarang bisa ikut berubah."
                  : "Ini periode lalu. Jumlah stamp dan level nggak berubah."}
              </p>
            ) : null}

            {destructive ? (
              <p className="text-sm text-muted-foreground text-pretty">
                Stamp ini nggak dihitung lagi. Jumlah stamp, progres reward, dan level ikut dihitung ulang. Datanya tetap ada di riwayat dengan tanda dihapus.
              </p>
            ) : null}

            {needsService ? (
              <div className="space-y-1.5">
                <Label htmlFor="stamp-correction-service">Treatment</Label>
                <Select
                  value={serviceId || undefined}
                  onValueChange={(value) => {
                    setServiceId(value);
                    setError(null);
                  }}
                  disabled={services.length === 0 || pending}
                >
                  <SelectTrigger
                    id="stamp-correction-service"
                    className="h-11 min-h-11 w-full min-w-0 rounded-md text-base"
                  >
                    <SelectValue placeholder="Pilih treatment" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="max-w-[var(--radix-select-trigger-width)]"
                  >
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
                {mode === "service" && stamp && !stamp.serviceId ? (
                  <p className="text-xs text-muted-foreground">Treatment lama udah nggak aktif.</p>
                ) : null}
              </div>
            ) : null}

            {needsDate ? (
              <div className="space-y-1.5">
                <Label htmlFor="stamp-correction-date">Tanggal kunjungan</Label>
                <DatePicker
                  id="stamp-correction-date"
                  value={visitDate ? isoToLocalDate(visitDate) : undefined}
                  onChange={(next) => {
                    setVisitDate(next ? localDateToISO(next) : "");
                    setDateError(null);
                    setConfirm(null);
                  }}
                  min={minDate}
                  max={maxDate}
                  disabled={pending}
                  placeholder="Pilih tanggal"
                  aria-invalid={Boolean(dateError)}
                  aria-describedby="stamp-correction-date-hint"
                />
                <p
                  id="stamp-correction-date-hint"
                  className={dateError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
                  role={dateError ? "alert" : undefined}
                >
                  {dateError ?? dateHint}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="stamp-correction-reason">
                Alasan <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Textarea
                id="stamp-correction-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void submit(confirm != null);
                  }
                }}
                maxLength={STAMP_REASON_MAX}
                rows={2}
                className="min-h-11 text-base md:text-base"
                placeholder={destructive ? "Misal: salah pilih member" : "Misal: kasir salah pilih"}
                disabled={pending}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">Kecatat di riwayat koreksi bareng nama kamu.</p>
            </div>

            {confirm ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm" role="alert">
                {confirm.kind === "claimed"
                  ? claimWarning(confirm.claims, confirm.countAfter, confirm.pastPeriod)
                  : `Udah ada stamp ${confirm.serviceName} di ${formatMemberDate(visitDate)}. Tetap simpan dua stamp di hari yang sama?`}
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-5 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              className="h-11 sm:h-9"
              disabled={pending || (needsService && services.length === 0)}
            >
              {pending ? "Menyimpan…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

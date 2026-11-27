"use client";

import { useEffect, useRef, useState } from "react";
import { isNetworkFailure } from "@/components/admin/members/add-stamp-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getVoucherWhatsAppLink } from "@/lib/actions/voucher-resend";
import { requestVoucherResend } from "@/lib/voucher-resend/client";
import { isValidEmailAddress, sameEmailAddress } from "@/lib/email-address";
import { cn } from "@/lib/utils";
import {
  deliveryStatusLine,
  resendBlockedReason,
  resendFailureMessage,
  type ResendTarget,
  type VoucherDeliveryOverview,
} from "@/lib/voucher-resend/shared";

export function VoucherDeliveryStatus({
  overview,
  loading,
  failed,
  onResend,
}: {
  overview: VoucherDeliveryOverview | null;
  loading: boolean;
  failed: boolean;
  onResend: (overview: VoucherDeliveryOverview) => void;
}) {
  if (loading) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="h-4 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
        <span className="sr-only">Memuat status kirim</span>
      </div>
    );
  }
  if (failed || !overview) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
        {failed ? "Status kirim gagal dimuat." : "Voucher belum dibuat."}
      </p>
    );
  }

  const line = deliveryStatusLine(overview);
  const blocked = resendBlockedReason(overview);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex items-start gap-2 text-sm break-words",
            line.tone === "error" ? "text-destructive" : line.tone === "ok" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-1.5 shrink-0 rounded-full",
              line.tone === "error" ? "bg-destructive" : line.tone === "ok" ? "bg-primary" : "bg-muted-foreground/50"
            )}
          />
          <span className="min-w-0">{line.text}</span>
        </p>
        {blocked ? <p className="mt-1 pl-3.5 text-xs text-muted-foreground">{blocked}</p> : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0"
        disabled={Boolean(blocked)}
        onClick={() => onResend(overview)}
      >
        Kirim ulang
      </Button>
    </div>
  );
}

interface ResendVoucherDialogProps {
  open: boolean;
  orderId: string;
  overview: VoucherDeliveryOverview | null;
  onOpenChange: (open: boolean) => void;
  onSent: (message: string) => void;
  onWhatsAppCopied: (message: string) => void;
}

function defaultTarget(overview: VoucherDeliveryOverview | null): ResendTarget {
  if (overview?.recipientEmail) return "RECIPIENT";
  if (overview?.buyerEmail) return "BUYER";
  return "CUSTOM";
}

export function ResendVoucherDialog({
  open,
  orderId,
  overview,
  onOpenChange,
  onSent,
  onWhatsAppCopied,
}: ResendVoucherDialogProps) {
  const [target, setTarget] = useState<ResendTarget>("RECIPIENT");
  const [email, setEmail] = useState("");
  const [saveAsRecipient, setSaveAsRecipient] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "whatsapp" | null>(null);
  const [syncKey, setSyncKey] = useState("");
  const mountedRef = useRef(true);

  const key = `${open}-${overview?.voucherId ?? "none"}`;
  if (key !== syncKey) {
    setSyncKey(key);
    if (open) {
      setTarget(defaultTarget(overview));
      setEmail("");
      setSaveAsRecipient(false);
      setEmailError(null);
      setError(null);
      setPending(null);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!overview) return null;

  const sameAddress = sameEmailAddress(overview.recipientEmail, overview.buyerEmail);
  const options: Array<{ value: ResendTarget; label: string; detail: string }> = [];
  if (overview.recipientEmail) {
    options.push({
      value: "RECIPIENT",
      label: sameAddress ? "Penerima (sama dengan pembeli)" : "Penerima",
      detail: overview.recipientEmail,
    });
  }
  if (overview.buyerEmail && !sameAddress) {
    options.push({ value: "BUYER", label: "Pembeli", detail: overview.buyerEmail });
  }
  options.push({ value: "CUSTOM", label: "Email lain", detail: "Ketik alamat baru" });

  const selected = options.find((option) => option.value === target) ?? null;
  const destination =
    target === "CUSTOM"
      ? email.trim()
      : options.find((option) => option.value === target)?.detail ?? "";
  const wa = overview.whatsAppTarget;

  function validateEmail(value: string): string | null {
    if (!value.trim()) return "Isi email tujuan dulu.";
    return isValidEmailAddress(value) ? null : resendFailureMessage("invalid_email");
  }

  async function sendEmail() {
    if (!overview) return;
    if (target === "CUSTOM") {
      const problem = validateEmail(email);
      setEmailError(problem);
      if (problem) return;
    }
    setPending("email");
    setError(null);
    try {
      const result = await requestVoucherResend({
        orderId,
        voucherId: overview.voucherId,
        target,
        email: target === "CUSTOM" ? email.trim() : undefined,
        saveAsRecipient: target === "CUSTOM" ? saveAsRecipient : undefined,
      });
      if (!mountedRef.current) return;
      setPending(null);
      if (result.status === "sent") {
        onSent(
          result.recipientEmailUpdated
            ? `Voucher dikirim ulang ke ${result.to}. Email penerima diganti.`
            : `Voucher dikirim ulang ke ${result.to}.`
        );
        onOpenChange(false);
        return;
      }
      if (result.status === "sent_not_logged") {
        onSent(`Voucher terkirim ke ${result.to}, tapi catatannya gagal disimpan. Jangan kirim ulang lagi.`);
        onOpenChange(false);
        return;
      }
      if (result.status === "invalid_email" && target === "CUSTOM") {
        setEmailError(resendFailureMessage("invalid_email"));
        return;
      }
      setError(resendFailureMessage(result.status, result.retryAfterSeconds));
    } catch (caught) {
      if (!mountedRef.current) return;
      setPending(null);
      setError(resendFailureMessage(isNetworkFailure(caught) ? "network" : "error"));
    }
  }

  async function copyWhatsApp() {
    if (!overview || !wa) return;
    setPending("whatsapp");
    setError(null);
    try {
      const result = await getVoucherWhatsAppLink({
        orderId,
        voucherId: overview.voucherId,
        target: wa.kind,
      });
      if (!mountedRef.current) return;
      setPending(null);
      if (result.status !== "ok") {
        setError(resendFailureMessage(result.status, result.retryAfterSeconds));
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        setError("Link WhatsApp gagal disalin. Izinkan akses clipboard di browser, lalu coba lagi.");
        return;
      }
      onWhatsAppCopied(
        `Link WhatsApp ke ${wa.kind === "RECIPIENT" ? "penerima" : "pembeli"} disalin. Buka di browser untuk kirim dari WhatsApp kasir.`
      );
    } catch (caught) {
      if (!mountedRef.current) return;
      setPending(null);
      setError(resendFailureMessage(isNetworkFailure(caught) ? "network" : "error"));
    }
  }

  const busy = pending !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void sendEmail();
          }}
        >
          <DialogHeader>
            <DialogTitle>Kirim ulang voucher</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{overview.code}</span>
              {overview.serviceName ? ` · ${overview.serviceName}` : ""} untuk {overview.recipientName}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="voucher-resend-target">Kirim ke</Label>
              <Select
                value={target}
                onValueChange={(value) => {
                  setTarget(value as ResendTarget);
                  setEmailError(null);
                  setError(null);
                }}
                disabled={busy}
              >
                <SelectTrigger
                  id="voucher-resend-target"
                  className="h-11 min-h-11 w-full min-w-0 rounded-md text-base"
                >
                  <SelectValue>
                    <span className="truncate">
                      {selected ? `${selected.label}${selected.value === "CUSTOM" ? "" : ` · ${selected.detail}`}` : ""}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  className="max-w-[var(--radix-select-trigger-width)]"
                >
                  {options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      textValue={option.label}
                      className="min-h-11 items-start whitespace-normal py-2 text-left text-base leading-snug [&>span:last-child]:block [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words"
                    >
                      <span className="block">{option.label}</span>
                      <span className="block text-sm text-muted-foreground break-all">{option.detail}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {target === "CUSTOM" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="voucher-resend-email">Email tujuan</Label>
                  <Input
                    id="voucher-resend-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    spellCheck={false}
                    value={email}
                    disabled={busy}
                    placeholder="nama@gmail.com"
                    className="h-11 text-base md:text-base"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "voucher-resend-email-error" : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (emailError) setEmailError(validateEmail(event.target.value));
                    }}
                    onBlur={() => {
                      if (email.trim()) setEmailError(validateEmail(email));
                    }}
                  />
                  {emailError ? (
                    <p id="voucher-resend-email-error" role="alert" className="text-sm text-destructive">
                      {emailError}
                    </p>
                  ) : null}
                </div>
                <label
                  htmlFor="voucher-resend-save"
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <Checkbox
                    id="voucher-resend-save"
                    checked={saveAsRecipient}
                    disabled={busy}
                    onCheckedChange={(checked) => setSaveAsRecipient(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug">
                    Simpan sebagai email penerima
                    <span className="mt-0.5 block text-muted-foreground">
                      Centang kalau email penerima salah ketik. Diganti setelah email terkirim.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground text-pretty">
              {destination
                ? `Email baru dengan PDF voucher dikirim ke ${destination}. Tercatat atas nama kamu.`
                : "Email baru dengan PDF voucher dikirim ke alamat ini. Tercatat atas nama kamu."}
            </p>

            {error ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {wa ? (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                  Atau kirim sendiri lewat WhatsApp {wa.kind === "RECIPIENT" ? "penerima" : "pembeli"}.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => void copyWhatsApp()}
                >
                  {pending === "whatsapp" ? "Menyiapkan…" : "Salin link WhatsApp"}
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {pending === "email" ? "Mengirim…" : "Kirim email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

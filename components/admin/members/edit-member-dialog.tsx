"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker, formatISODate, parseISODate, preventCloseOnDatePickerLayer } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMember } from "@/lib/actions/members";
import type { MemberSummary } from "@/lib/membership/summary";

interface EditMemberDialogProps {
  open: boolean;
  summary: MemberSummary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (summary: MemberSummary | null, memberId: string) => void;
}

export function EditMemberDialog({
  open,
  summary,
  onOpenChange,
  onSaved,
}: EditMemberDialogProps) {
  const [name, setName] = useState(summary?.name ?? "");
  const [phone, setPhone] = useState(summary?.phone ?? "");
  const [birthDate, setBirthDate] = useState(summary?.birthDate?.slice(0, 10) ?? "");
  const [waConsent, setWaConsent] = useState(summary?.waConsent ?? false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ phone?: string }>({});
  const [pending, setPending] = useState(false);
  const [syncedOpen, setSyncedOpen] = useState(open);
  const [syncedId, setSyncedId] = useState(summary?.id ?? "");
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  if (open !== syncedOpen || (summary?.id ?? "") !== syncedId) {
    setSyncedOpen(open);
    setSyncedId(summary?.id ?? "");
    if (open && summary) {
      setName(summary.name);
      setPhone(summary.phone);
      setBirthDate(summary.birthDate.slice(0, 10));
      setWaConsent(summary.waConsent);
      setError(null);
      setFieldError({});
      setPending(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPending(false);
          setError(null);
          setFieldError({});
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        onPointerDownOutside={preventCloseOnDatePickerLayer}
        onFocusOutside={preventCloseOnDatePickerLayer}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!summary) return;
            const requestId = requestRef.current + 1;
            requestRef.current = requestId;
            setPending(true);
            setError(null);
            setFieldError({});
            void updateMember({
              memberId: summary.id,
              name,
              phone,
              birthDate,
              waConsent,
            })
              .then((result) => {
                if (!mountedRef.current || requestId !== requestRef.current) return;
                setPending(false);
                if (result.status === "ok") {
                  onSaved(result.summary, result.summary.id);
                  onOpenChange(false);
                  return;
                }
                if (result.status === "saved") {
                  onSaved(null, result.memberId);
                  onOpenChange(false);
                  return;
                }
                if (result.status === "duplicate") {
                  setFieldError({ phone: result.message });
                  return;
                }
                if (result.status === "invalid") {
                  setError("Cek nama, nomor, dan tanggal lahir.");
                  return;
                }
                if (result.status === "not_found") {
                  setError("Member ini sudah tidak ada.");
                  return;
                }
                setError("Perubahan belum tersimpan. Coba lagi.");
              })
              .catch(() => {
                if (!mountedRef.current || requestId !== requestRef.current) return;
                setPending(false);
                setError("Perubahan belum tersimpan. Coba lagi.");
              });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit data member</DialogTitle>
            <DialogDescription>
              Nama, nomor HP, tanggal lahir, dan izin WhatsApp. Stamp dan level tidak berubah.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-member-name">Nama panggilan</Label>
              <Input
                id="edit-member-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={40}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-member-phone">Nomor HP (WhatsApp)</Label>
              <Input
                id="edit-member-phone"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (fieldError.phone) setFieldError({});
                }}
                inputMode="numeric"
                autoComplete="tel-national"
                required
                aria-invalid={Boolean(fieldError.phone)}
              />
              {fieldError.phone ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldError.phone}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-member-birth">Tanggal lahir</Label>
              <DatePicker
                id="edit-member-birth"
                value={parseISODate(birthDate)}
                onChange={(date) => setBirthDate(date ? formatISODate(date) : "")}
                min={new Date(1900, 0, 1)}
                max={new Date()}
                placeholder="Pilih tanggal lahir"
                required
              />
              <p className="text-xs text-muted-foreground">
                Kalau tanggal lahir diubah, jendela diskon ultah ikut pindah.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={waConsent} onCheckedChange={(value) => setWaConsent(value === true)} />
              <span>
                Customer setuju dihubungi lewat WhatsApp
                <span className="mt-1 block text-xs text-muted-foreground">
                  Buat pengingat treatment dan ucapan ulang tahun.
                </span>
              </span>
            </label>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending || !summary}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

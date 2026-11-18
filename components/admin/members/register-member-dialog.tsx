"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerMember } from "@/lib/actions/members";
import { displayUrl } from "@/lib/membership/format";
import { memberCardUrl } from "@/lib/membership/urls";
import type { MemberSummary } from "@/lib/membership/summary";

interface RegisterMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
  onCreated: (summary: MemberSummary) => void;
  onOpenExisting: (memberId: string) => void;
}

export function RegisterMemberDialog({
  open,
  onOpenChange,
  initialPhone = "",
  onCreated,
  onOpenExisting,
}: RegisterMemberDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [birthDate, setBirthDate] = useState("");
  const [waConsent, setWaConsent] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ memberId: string; name: string } | null>(null);
  const [registeredId, setRegisteredId] = useState<string | null>(null);
  const [created, setCreated] = useState<MemberSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [syncedOpen, setSyncedOpen] = useState(open);
  const [syncedPhone, setSyncedPhone] = useState(initialPhone);
  if (open !== syncedOpen || initialPhone !== syncedPhone) {
    setSyncedOpen(open);
    setSyncedPhone(initialPhone);
    if (open) {
      setPhone(initialPhone);
      setPending(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = () => {
    setName("");
    setPhone(initialPhone);
    setBirthDate("");
    setWaConsent(false);
    setError(null);
    setDuplicate(null);
    setRegisteredId(null);
    setCreated(null);
  };

  const cardUrl = created ? safeCardUrl(created.cardToken) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestRef.current += 1;
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-member-card, .print-member-card * { visibility: visible; }
            .print-member-card {
              position: absolute;
              inset: 0;
              background: white;
              padding: 24px;
            }
            .no-print { display: none !important; }
          }
        `}</style>
        {created ? (
          <>
            <div className="print-member-card">
            <DialogHeader>
              <DialogTitle>{created.name.split(" ")[0]} udah jadi member</DialogTitle>
              <DialogDescription>
                Kirim link kartunya lewat WhatsApp biar {created.name.split(" ")[0]} bisa buka QR-nya kapan aja.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4 rounded-xl bg-muted/40 p-3">
              <div className="rounded-lg bg-white p-2">
                {cardUrl ? <QRCode value={cardUrl} size={112} /> : null}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium">Link kartu member</p>
                <p className="truncate text-sm text-muted-foreground">{displayUrl(cardUrl)}</p>
                <div className="no-print flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(cardUrl)}
                  >
                    Salin
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                    Cetak
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Customer simpan link ini buat cek stamp dan tunjukin QR di kasir.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Stamp pertama cuma kalau kunjungan hari ini walk-in.
            </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const url = `https://wa.me/${created.phone}?text=${encodeURIComponent(`Halo ${created.name.split(" ")[0]}, ini link kartu member Kalanara kamu: ${cardUrl}`)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                Kirim link via WhatsApp
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onCreated(created);
                  onOpenChange(false);
                  reset();
                }}
              >
                Tambah stamp pertama
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const requestId = requestRef.current + 1;
              requestRef.current = requestId;
              setPending(true);
              setError(null);
              setDuplicate(null);
              setRegisteredId(null);
              void registerMember({ name, phone, birthDate, waConsent }).then((result) => {
                if (!mountedRef.current || requestId !== requestRef.current) return;
                setPending(false);
                if (result.status === "ok") {
                  setCreated(result.summary);
                  return;
                }
                if (result.status === "created") {
                  setRegisteredId(result.memberId);
                  return;
                }
                if (result.status === "duplicate") {
                  setDuplicate({ memberId: result.memberId, name: result.name });
                  return;
                }
                if (result.status === "invalid") {
                  setError("Cek nama, nomor, dan tanggal lahir.");
                  return;
                }
                setError("Belum kedaftar. Koneksi putus.");
              }).catch(() => {
                if (!mountedRef.current || requestId !== requestRef.current) return;
                setPending(false);
                setError("Belum kedaftar. Koneksi putus.");
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Daftar member baru</DialogTitle>
              <DialogDescription>
                Customer langsung dapat QR member dan link kartunya.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="member-name">Nama panggilan</Label>
                <Input id="member-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} />
                <p className="text-xs text-muted-foreground">Dipakai buat sapaan di WhatsApp.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-phone">Nomor HP (WhatsApp)</Label>
                <Input
                  id="member-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-birth">Tanggal lahir</Label>
                <Input id="member-birth" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
                <p className="text-xs text-muted-foreground">Buat diskon ulang tahun 25%. Cuma admin yang bisa ubah.</p>
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
              {duplicate ? (
                <div className="space-y-2 text-sm text-destructive" role="alert">
                  <p>Nomor ini udah terdaftar{duplicate.name ? ` atas nama ${duplicate.name}` : ""}.</p>
                  {duplicate.memberId ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onOpenExisting(duplicate.memberId)}
                    >
                      Buka kartu {duplicate.name.split(" ")[0] || "member"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {registeredId ? (
                <div className="space-y-2 text-sm" role="status">
                  <p>Member kedaftar, tapi kartunya belum ke-load.</p>
                  <Button type="button" size="sm" onClick={() => onOpenExisting(registeredId)}>
                    Buka kartunya
                  </Button>
                </div>
              ) : null}
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Mendaftarkan..." : "Daftarkan member"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function safeCardUrl(token: string): string {
  try {
    return memberCardUrl(token);
  } catch {
    return "";
  }
}

"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
import { MemberQr } from "@/components/member/member-qr";
import { regenerateSignupQr } from "@/lib/actions/members";
import { displayUrl, formatMemberDate, formatMemberTime, memberInitials } from "@/lib/membership/format";

interface SignupQrPanelProps {
  url: string;
  createdAt: string;
  monthCount: number;
  recent: Array<{ id: string; name: string; createdAt: string; stampCount: number }>;
}

export function SignupQrPanel({ url, createdAt, monthCount, recent }: SignupQrPanelProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState({ url, createdAt, monthCount, recent });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium">QR daftar sendiri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Taruh di meja depan. Customer scan, isi data di HP sendiri, langsung jadi member. Stamp pertama tetap dari kasir.
        </p>
        <div className="mt-4 flex flex-col gap-4 rounded-xl bg-muted/40 p-4 sm:flex-row">
          <div className="w-40 shrink-0">
            <MemberQr value={current.url} size={140} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Link pendaftaran</p>
            <p className="truncate text-sm text-muted-foreground">{displayUrl(current.url)}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                const write = navigator.clipboard?.writeText.bind(navigator.clipboard);
                if (!write) {
                  window.prompt("Salin link ini:", current.url);
                  return;
                }
                setCopied(true);
                void write(current.url).catch(() => {
                  setCopied(false);
                  window.prompt("Salin link ini:", current.url);
                });
              }}
            >
              {copied ? (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Tersalin
                </>
              ) : (
                "Salin link"
              )}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Aktif sejak {formatMemberDate(current.createdAt)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" asChild>
            <a href="/api/members/signup-qr.png">Download PNG</a>
          </Button>
          <Button type="button" asChild>
            <a href="/admin/members/settings/poster" target="_blank" rel="noreferrer">
              Cetak poster A5
            </a>
          </Button>
        </div>
      </section>
      <div className="space-y-4">
        <section className="rounded-xl border p-4">
          <p className="text-3xl font-semibold tabular-nums">{current.monthCount}</p>
          <p className="text-sm text-muted-foreground">member daftar sendiri bulan ini</p>
          {current.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada yang daftar sendiri. Yang daftar lewat QR muncul di sini.
            </p>
          ) : null}
          <ul className="mt-3">
            {current.recent.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                  {memberInitials(member.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMemberDate(member.createdAt)} {formatMemberTime(member.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {member.stampCount === 0 ? "Belum ada stamp" : `${member.stampCount} stamp`}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Ganti QR</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pakai kalau QR atau posternya kesebar di luar toko. QR lama langsung mati. Member yang udah daftar aman.
              </p>
            </div>
            <Button type="button" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
              Ganti QR
            </Button>
          </div>
        </section>
      </div>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti QR daftar sendiri?</AlertDialogTitle>
            <AlertDialogDescription>
              QR dan poster lama langsung nggak bisa dipakai. Customer yang scan QR lama diminta tanya kasir. Member yang udah daftar tetap aman.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">Habis ini:</p>
            <ol className="mt-2 list-decimal pl-4">
              <li>Cetak poster baru.</li>
              <li>Ganti poster di meja depan.</li>
            </ol>
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setPending(true);
                setError(null);
                void regenerateSignupQr()
                  .then((result) => {
                    setPending(false);
                    if (result.status === "ok") {
                      setCurrent({
                        url: result.url,
                        createdAt: result.createdAt,
                        monthCount: result.monthCount,
                        recent: result.recent,
                      });
                      setError(null);
                      setOpen(false);
                      return;
                    }
                    if (result.status === "rotated") {
                      setCurrent((current) => ({
                        ...current,
                        url: result.url,
                        createdAt: result.createdAt,
                      }));
                      setError(null);
                      setOpen(false);
                      return;
                    }
                    setError("QR belum diganti. Coba lagi, atau muat ulang halaman kalau QR lamanya udah nggak aktif.");
                  })
                  .catch(() => {
                    setPending(false);
                    setError("QR belum diganti. Koneksi putus. Coba lagi.");
                  });
              }}
            >
              {pending ? "Mengganti…" : "Ya, ganti QR"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

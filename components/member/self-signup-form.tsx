"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selfSignup } from "@/lib/actions/members";
import { maskMemberPhone } from "@/lib/membership/format";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { MemberShell } from "@/components/member/member-shell";
import { APP_CONFIG } from "@/lib/constants";

interface SelfSignupFormProps {
  qrToken: string;
  qrState: "active" | "invalid" | "error";
}

export function SelfSignupForm({ qrToken, qrState }: SelfSignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [waConsent, setWaConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; birthDate?: string; form?: string }>({});
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  if (qrState === "error") {
    return (
      <MemberShell title="Daftar member" subtitle="Pendaftaran belum bisa dibuka">
        <section className="rounded-2xl bg-background px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-semibold">Belum bisa memuat QR</p>
          <p className="mt-2 text-sm text-muted-foreground">Koneksi putus. Coba lagi.</p>
          <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
            Coba lagi
          </Button>
        </section>
      </MemberShell>
    );
  }

  if (qrState === "invalid") {
    return (
      <MemberShell title="Daftar member" subtitle="QR ini udah nggak dipakai">
        <section className="rounded-2xl bg-background px-6 py-12 text-center shadow-sm">
          <QrCode className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">QR ini udah nggak dipakai</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Minta QR baru ke kasir Kalanara, atau scan poster di meja depan.
          </p>
        </section>
      </MemberShell>
    );
  }

  if (duplicatePhone) {
    return (
      <MemberShell title="Daftar member" subtitle="Satu nomor, satu kartu member.">
        <section className="rounded-2xl bg-background px-6 py-10 text-center shadow-sm">
          <Smartphone className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Nomor ini udah terdaftar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {duplicatePhone} udah jadi member Kalanara. Demi keamanan, link kartunya nggak kami tampilin di sini.
          </p>
          <div className="mt-4 rounded-xl bg-muted/50 p-4 text-left text-sm">
            <p className="font-medium">Biar dapat link kartu kamu:</p>
            <p className="mt-1 text-muted-foreground">
              Bilang ke kasir pas datang. Kasir kirim ulang link-nya ke WhatsApp kamu.
            </p>
          </div>
          <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={() => setDuplicatePhone(null)}>
            Pakai nomor lain
          </Button>
        </section>
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
          <Button asChild className="h-11 w-full bg-foreground text-background">
            <a href={APP_CONFIG.social.whatsapp}>Chat Kalanara</a>
          </Button>
        </div>
      </MemberShell>
    );
  }

  function validate() {
    const next: { phone?: string; birthDate?: string } = {};
    if (!normalizeMemberPhone(phone)) {
      next.phone = "Nomor WhatsApp-nya kurang panjang. Contoh: 812 3456 7890.";
    }
    if (!birthDate) next.birthDate = "Pilih tanggal lahir kamu.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <MemberShell title="Daftar member" subtitle="Isi 3 data. Langsung jadi member, gratis.">
      <form
        className="rounded-2xl bg-background p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validate()) return;
          setPending(true);
          setBlocked(false);
          setErrors({});
          void selfSignup({ qrToken, name, phone, birthDate, waConsent, website }).then((result) => {
            setPending(false);
            if (result.status === "ok" && result.cardPath) {
              router.push(result.cardPath);
              return;
            }
            if (result.status === "ok") return;
            if (result.status === "duplicate") {
              const normalized = normalizeMemberPhone(phone);
              setDuplicatePhone(normalized ? maskMemberPhone(normalized) : phone);
              return;
            }
            if (result.status === "rate_limited") {
              setBlocked(true);
              return;
            }
            if (result.status === "invalid") {
              validate();
              return;
            }
            setErrors({ form: "Belum kedaftar. Koneksi putus. Isian kamu masih ada." });
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Nama panggilan</Label>
          <Input
            id="signup-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={40}
            className="h-11 text-base"
          />
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="signup-phone">Nomor WhatsApp</Label>
          <div className={`flex h-11 items-center rounded-lg border bg-background ${errors.phone ? "border-destructive" : ""}`}>
            <span className="px-3 text-base text-muted-foreground">+62</span>
            <Input
              id="signup-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={validate}
              inputMode="numeric"
              autoComplete="tel-national"
              className="h-11 border-0 text-base shadow-none focus-visible:ring-0"
              aria-invalid={Boolean(errors.phone)}
              required
            />
          </div>
          {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="signup-birth">Tanggal lahir</Label>
          <Input
            id="signup-birth"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            onBlur={validate}
            className={`h-11 text-base ${errors.birthDate ? "border-destructive" : ""}`}
            aria-invalid={Boolean(errors.birthDate)}
            required
          />
          {errors.birthDate ? (
            <p className="text-sm text-destructive">{errors.birthDate}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Buat diskon ulang tahun 25%.</p>
          )}
        </div>
        <label className="mt-4 flex items-start gap-3 border-t pt-4 text-sm">
          <Checkbox checked={waConsent} onCheckedChange={(value) => setWaConsent(value === true)} className="mt-0.5" />
          <span>
            Boleh dihubungi lewat WhatsApp
            <span className="mt-1 block text-xs text-muted-foreground">
              Buat pengingat treatment dan ucapan ulang tahun. Bisa berhenti kapan aja.
            </span>
          </span>
        </label>
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          className="hidden"
          aria-hidden="true"
          name="website"
        />
        {errors.form ? <p className="mt-3 text-sm text-destructive">{errors.form}</p> : null}
        {blocked ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Terlalu banyak percobaan dari HP ini. Coba lagi 15 menit lagi.
          </p>
        ) : null}
        <Button type="submit" disabled={pending || blocked} className="mt-4 h-11 w-full bg-foreground text-base text-background">
          {pending ? "Mendaftarkan..." : "Daftar jadi member"}
        </Button>
      </form>
      <p className="px-2 text-sm text-muted-foreground">
        Data kamu cuma dipakai Kalanara. Nggak dibagi ke pihak lain.
      </p>
    </MemberShell>
  );
}

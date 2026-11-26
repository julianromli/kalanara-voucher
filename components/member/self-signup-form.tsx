"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker, formatISODate, parseISODate } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selfSignup } from "@/lib/actions/members";
import { jakartaDateISO, maskMemberPhone } from "@/lib/membership/format";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { MemberShell } from "@/components/member/member-shell";
import { APP_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

function retryCopy(minutes: number | null): string {
  if (minutes === 60) return "Coba lagi 1 jam lagi.";
  if (minutes === 15) return "Coba lagi 15 menit lagi.";
  if (minutes && minutes > 0) return `Coba lagi ${minutes} menit lagi.`;
  return "Coba lagi nanti.";
}

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
  const [errors, setErrors] = useState<{ name?: string; phone?: string; birthDate?: string; form?: string }>({});
  const [duplicatePhone, setDuplicatePhone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [retryAfterMinutes, setRetryAfterMinutes] = useState<number | null>(null);
  const [qrRevoked, setQrRevoked] = useState(false);

  if (qrState === "error") {
    return (
      <MemberShell title="Daftar member" subtitle="Pendaftaran belum bisa dibuka">
        <section className="rounded-xl bg-background px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-semibold">Belum bisa memuat QR</p>
          <p className="mt-2 text-sm text-muted-foreground">Koneksi putus. Coba lagi.</p>
          <Button type="button" variant="outline" className="mt-4 h-11 px-6 text-base" onClick={() => window.location.reload()}>
            Coba lagi
          </Button>
        </section>
      </MemberShell>
    );
  }

  if (qrState === "invalid" || qrRevoked) {
    return (
      <MemberShell title="Daftar member" subtitle="QR ini udah nggak dipakai">
        <section className="rounded-xl bg-background px-6 py-12 text-center shadow-sm">
          <QrCode className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
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
      <MemberShell
        title="Daftar member"
        subtitle="Satu nomor, satu kartu member."
        footer={
          <Button asChild className="h-11 w-full text-base">
            <a href={APP_CONFIG.social.whatsapp}>Chat Kalanara</a>
          </Button>
        }
      >
        <section className="rounded-xl bg-background px-6 py-10 text-center shadow-sm">
          <Smartphone className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Nomor ini udah terdaftar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {duplicatePhone} udah jadi member Kalanara. Demi keamanan, link kartunya nggak kami tampilin di sini.
          </p>
          <div className="mt-4 rounded-lg bg-muted/50 p-4 text-left text-sm">
            <p className="font-medium">Biar dapat link kartu kamu:</p>
            <p className="mt-1 text-muted-foreground">
              Bilang ke kasir pas datang. Kasir kirim ulang link-nya ke WhatsApp kamu.
            </p>
          </div>
          <Button type="button" variant="outline" className="mt-4 h-11 w-full text-base" onClick={() => setDuplicatePhone(null)}>
            Pakai nomor lain
          </Button>
        </section>
      </MemberShell>
    );
  }

  // On blur, check only the field the customer just left. On submit, check all.
  function validate(only?: "phone" | "birthDate") {
    const next: { name?: string; phone?: string; birthDate?: string } = {};
    if (name.trim().length === 0) {
      next.name = "Isi nama panggilan kamu.";
    }
    if (!normalizeMemberPhone(phone)) {
      next.phone = "Nomor WhatsApp-nya kurang panjang. Contoh: 812 3456 7890.";
    }
    const today = jakartaDateISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > today || Number(birthDate.slice(0, 4)) < 1900) {
      next.birthDate = "Pilih tanggal lahir kamu.";
    }
    if (only) {
      setErrors((current) => ({ ...current, [only]: next[only] }));
      return !next[only];
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <MemberShell title="Daftar member" subtitle="Isi 3 data. Langsung jadi member, gratis.">
      <form
        noValidate
        className="rounded-xl bg-background p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validate()) return;
          setPending(true);
          setBlocked(false);
          setErrors({});
          void selfSignup({ qrToken, name, phone, birthDate, waConsent, website }).then((result) => {
            if (result.status === "ok" && result.cardPath) {
              router.push(result.cardPath);
              return;
            }
            setPending(false);
            if (result.status === "ok") return;
            if (result.status === "duplicate") {
              const normalized = normalizeMemberPhone(phone);
              setDuplicatePhone(normalized ? maskMemberPhone(normalized) : phone);
              return;
            }
            if (result.status === "rate_limited") {
              setBlocked(true);
              setRetryAfterMinutes(result.retryAfterMinutes);
              window.setTimeout(() => setBlocked(false), result.retryAfterMinutes * 60 * 1000);
              return;
            }
            if (result.status === "invalid_qr") {
              setQrRevoked(true);
              return;
            }
            if (result.status === "invalid") {
              if (!validate()) return;
              setErrors({ form: "Cek nama, nomor, dan tanggal lahir." });
              return;
            }
            setErrors({ form: "Belum kedaftar. Koneksi putus. Isian kamu masih ada." });
          }).catch(() => {
            setPending(false);
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
            autoComplete="nickname"
            className={cn("h-11 text-base md:text-base", errors.name && "border-destructive")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "signup-name-error" : undefined}
          />
          {errors.name ? <p id="signup-name-error" className="text-sm text-destructive">{errors.name}</p> : null}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="signup-phone">Nomor WhatsApp</Label>
          <div className={cn("flex h-11 items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50", errors.phone && "border-destructive")}>
            <span className="pl-3 text-base text-muted-foreground" aria-hidden="true">+62</span>
            <Input
              id="signup-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={() => phone && validate("phone")}
              inputMode="numeric"
              autoComplete="tel-national"
              className="h-11 border-0 text-base shadow-none focus-visible:ring-0 md:text-base"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "signup-phone-error" : undefined}
              required
            />
          </div>
          {errors.phone ? <p id="signup-phone-error" className="text-sm text-destructive">{errors.phone}</p> : null}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="signup-birth">Tanggal lahir</Label>
          <DatePicker
            id="signup-birth"
            value={parseISODate(birthDate)}
            onChange={(date) => {
              const next = date ? formatISODate(date) : "";
              setBirthDate(next);
              if (errors.birthDate) {
                setErrors((current) => ({ ...current, birthDate: undefined }));
              }
            }}
            min={new Date(1900, 0, 1)}
            max={new Date()}
            placeholder="Pilih tanggal lahir"
            required
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby="signup-birth-hint"
            className={errors.birthDate ? "[&_button]:border-destructive" : undefined}
          />
          {errors.birthDate ? (
            <p id="signup-birth-hint" className="text-sm text-destructive">{errors.birthDate}</p>
          ) : (
            <p id="signup-birth-hint" className="text-sm text-muted-foreground">Buat diskon ulang tahun 25%.</p>
          )}
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 border-t pt-4 text-sm">
          <Checkbox checked={waConsent} onCheckedChange={(value) => setWaConsent(value === true)} className="mt-0.5" />
          <span>
            Boleh dihubungi lewat WhatsApp
            <span className="mt-1 block text-sm text-muted-foreground">
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
        {errors.form ? <p className="mt-3 text-sm text-destructive" role="alert">{errors.form}</p> : null}
        {blocked ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            Terlalu banyak percobaan dari HP ini. {retryCopy(retryAfterMinutes)}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || blocked} className="mt-4 h-11 w-full text-base">
          {pending ? "Mendaftarkan…" : "Daftar jadi member"}
        </Button>
      </form>
      <p className="px-2 text-sm text-muted-foreground">
        Data kamu cuma dipakai Kalanara. Nggak dibagi ke pihak lain.
      </p>
    </MemberShell>
  );
}

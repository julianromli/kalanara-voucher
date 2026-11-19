import { Calendar, Link2 } from "lucide-react";
import { MemberHero } from "@/components/member/member-hero";
import { MemberShell } from "@/components/member/member-shell";
import { RewardLadder } from "@/components/member/reward-ladder";
import { StampCard } from "@/components/member/stamp-card";
import { Button } from "@/components/ui/button";
import { loadPublicMember } from "@/lib/actions/members";
import { APP_CONFIG } from "@/lib/constants";
import { formatMemberDate, firstName } from "@/lib/membership/format";
import { tierName } from "@/lib/membership/rules";
import { memberCardUrl } from "@/lib/membership/urls";

interface MemberPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ baru?: string }>;
}

export default async function MemberCardPage({ params, searchParams }: MemberPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const result = await loadPublicMember(token);

  if (result.status !== "ok") {
    const failed = result.status === "error";
    return (
      <MemberShell
        title="Kartu member"
        subtitle={failed ? "Kartu belum bisa dibuka" : "Link ini nggak bisa dibuka"}
        footer={
          <Button asChild className="h-11 w-full bg-foreground text-base text-background hover:bg-foreground/90">
            <a href={APP_CONFIG.social.whatsapp}>Chat Kalanara</a>
          </Button>
        }
      >
        <section className="rounded-xl bg-background px-6 py-12 text-center shadow-sm">
          <Link2 className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">
            {failed ? "Kartu belum bisa dibuka" : "Link kartu nggak ketemu"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed
              ? "Koneksi putus. Coba buka link ini lagi."
              : "Mungkin link-nya kepotong atau udah diganti. Minta link baru ke kasir Kalanara, atau chat kami."}
          </p>
          {failed ? (
            <Button variant="outline" className="mt-4 h-11 px-6 text-base" asChild>
              <a href={`/m/${token}`}>Coba lagi</a>
            </Button>
          ) : null}
        </section>
      </MemberShell>
    );
  }
  const summary = result.summary;

  let cardUrl = "";
  try {
    cardUrl = memberCardUrl(summary.cardToken);
  } catch {
    cardUrl = "";
  }
  const greeting = summary.stampCount === 0
    ? "Selamat datang di member Kalanara"
    : summary.effectiveTier === 3
      ? "Member Gold Kalanara"
      : "Kartu member Kalanara kamu";
  const reserveText = summary.birthday.eligible
    ? `Halo Kalanara, saya ${summary.name}. Saya mau reservasi dan pakai diskon ulang tahun.`
    : `Halo Kalanara, saya ${summary.name}. Saya mau reservasi treatment.`;

  return (
    <MemberShell
      title={`Halo, ${firstName(summary.name)}`}
      subtitle={greeting}
      footer={
        <Button asChild className="h-11 w-full bg-foreground text-base text-background hover:bg-foreground/90">
          <a
            href={`${APP_CONFIG.social.whatsapp}?text=${encodeURIComponent(reserveText)}`}
          >
            {summary.birthday.eligible ? "Reservasi pakai diskon ultah" : "Reservasi via WhatsApp"}
          </a>
        </Button>
      }
    >
      <MemberHero
        name={summary.name}
        memberCode={summary.memberCode}
        tier={summary.effectiveTier}
        cardUrl={cardUrl}
        welcome={query.baru === "1"}
      />
      {summary.birthday.eligible ? (
        <section className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm">
          <p className="font-medium">Selamat ulang tahun, {firstName(summary.name)}!</p>
          <p className="mt-1">Diskon 25% buat 1 treatment</p>
          <p className="mt-1 text-muted-foreground">
            Berlaku sampai {formatMemberDate(summary.birthday.windowEnd)}. Bilang ke kasir pas datang ya.
          </p>
        </section>
      ) : null}
      <StampCard summary={summary} />
      <RewardLadder summary={summary} />
      <section className="rounded-xl bg-background p-4 text-sm shadow-sm">
        {summary.lastTreatment ? (
          <p className="flex gap-2">
            <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              Treatment terakhir
              <span className="mt-1 block text-muted-foreground">
                {summary.lastTreatment.serviceName} · {formatMemberDate(summary.lastTreatment.date)}
              </span>
            </span>
          </p>
        ) : null}
        <p className="mt-3 flex gap-2">
          <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Periode stamp
            <span className="mt-1 block text-muted-foreground">
              Sampai {formatMemberDate(summary.resetOn)}. Setelah itu stamp mulai dari 0
              {summary.effectiveTier > 0
                ? `, level turun satu tingkat ke ${tierName(summary.effectiveTier - 1)}`
                : ""}
              .
            </span>
          </span>
        </p>
      </section>
    </MemberShell>
  );
}

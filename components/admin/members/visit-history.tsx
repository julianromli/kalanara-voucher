import { formatMemberDate, firstName } from "@/lib/membership/format";
import type { MemberSummary } from "@/lib/membership/summary";

interface VisitHistoryProps {
  summary: MemberSummary;
}

export function VisitHistory({ summary }: VisitHistoryProps) {
  const events = [
    ...summary.stamps.map((stamp) => ({
      id: stamp.id,
      at: stamp.createdAt,
      title: stamp.serviceName,
      meta: `${formatMemberDate(stamp.visitDate)} · Walk-in${stamp.createdByName ? ` · ${firstName(stamp.createdByName)}` : ""}`,
      aside: "+1 stamp",
    })),
    ...summary.claims.map((claim) => ({
      id: claim.id,
      at: claim.claimedAt,
      title: claim.serviceName || claim.rewardName,
      meta: `${formatMemberDate(claim.claimedAt)} · Reward ${claim.milestone}×${claim.claimedByName ? ` · ${firstName(claim.claimedByName)}` : ""}`,
      aside: "Diklaim",
    })),
    ...summary.birthdayRedemptions.map((redemption) => ({
      id: redemption.id,
      at: redemption.redeemedAt,
      title: redemption.serviceName || "Diskon ulang tahun",
      meta: `${formatMemberDate(redemption.redeemedAt)} · Ulang tahun`,
      aside: "Dipakai",
    })),
  ].sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0));

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Riwayat kunjungan</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada kunjungan.</p>
      ) : (
        <ul>
          {events.slice(0, 8).map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{event.title}</p>
                <p className="text-xs text-muted-foreground">{event.meta}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{event.aside}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

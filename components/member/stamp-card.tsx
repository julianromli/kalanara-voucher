import { Check, Gift } from "lucide-react";
import { progressCopy } from "@/lib/membership/copy";
import { formatMemberDate } from "@/lib/membership/format";
import { tierName } from "@/lib/membership/rules";
import type { MemberSummary } from "@/lib/membership/summary";
import { cn } from "@/lib/utils";

interface StampCardProps {
  summary: MemberSummary;
  welcome?: boolean;
}

export function StampCard({ summary, welcome = false }: StampCardProps) {
  const progress = progressCopy(summary);
  const bracketEnd =
    summary.stampCount === 0
      ? 5
      : summary.stampCount % 5 === 0
        ? Math.min(summary.stampCount, 30)
        : Math.min(Math.ceil(summary.stampCount / 5) * 5, 30);
  const bracketStart = bracketEnd - 4;
  const marks = Array.from({ length: 5 }, (_, index) => bracketStart + index);
  const filled = Math.max(0, Math.min(summary.stampCount, bracketEnd) - bracketStart + 1);

  return (
    <section className="rounded-2xl bg-background p-4 shadow-sm">
      <p className="text-4xl font-semibold tracking-tight">
        {summary.stampCount} <span className="text-base font-medium text-muted-foreground">stamp</span>
      </p>
      <p className="mt-2 text-sm font-medium">
        {summary.stampCount === 0
          ? "Stamp pertama kamu nunggu di kunjungan berikutnya"
          : summary.stampCount >= 30
            ? "Stamp kamu udah penuh"
            : progress.title}
      </p>
      <p className="text-sm text-muted-foreground">
        {summary.stampCount === 0
          ? "Tiap 5 stamp ada reward."
          : summary.stampCount >= 30
            ? `Stamp berhenti di 30. Mulai lagi dari 0 tanggal ${formatMemberDate(summary.resetOn)}. Level turun ke ${tierName(Math.max(summary.effectiveTier - 1, 0))}.`
            : progress.detail}
      </p>
      {summary.stampCount === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Voucher dari website nggak dapat stamp.</p>
      ) : null}
      <div className="mt-4 grid grid-cols-6 gap-2">
        {marks.map((mark, index) => {
          const done = index < filled;
          return (
            <span
              key={mark}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full text-xs",
                done ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : mark}
            </span>
          );
        })}
        <span className="flex aspect-square items-center justify-center rounded-full border border-dashed text-muted-foreground">
          <Gift className="size-4" />
        </span>
      </div>
      {welcome ? null : null}
    </section>
  );
}

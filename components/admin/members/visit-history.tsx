"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import {
  StampCorrectionDialog,
  type StampCorrectionMode,
} from "@/components/admin/members/stamp-correction-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listStampHistory } from "@/lib/actions/members";
import { firstName, formatMemberDate, formatMemberTime, jakartaDateISO } from "@/lib/membership/format";
import {
  levelChangeNote,
  periodLabel,
  roleLabel,
  stampAuditSummary,
  type StampHistory,
  type StampHistoryStamp,
} from "@/lib/membership/stamp-corrections";
import type { MemberSummary } from "@/lib/membership/summary";

interface VisitHistoryProps {
  summary: MemberSummary;
  services?: Array<{ id: string; name: string }>;
  /** Called after a correction is saved, with the message to show. */
  onCorrected?: (message: string) => void;
}

interface VisitEvent {
  id: string;
  at: string;
  title: string;
  meta: string;
  aside: string;
  stamp?: StampHistoryStamp;
  voided?: boolean;
}

const VISIBLE_EVENTS = 8;
const VISIBLE_AUDIT = 5;

export function VisitHistory({ summary, services = [], onCorrected }: VisitHistoryProps) {
  // Each loaded result carries its member id, so a late answer for the
  // previous member can never show on the current one.
  const [loaded, setLoaded] = useState<{
    memberId: string;
    status: "ok" | "error";
    history: StampHistory | null;
  } | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [dialog, setDialog] = useState<{ mode: StampCorrectionMode; stamp: StampHistoryStamp | null } | null>(null);
  const [viewedMemberId, setViewedMemberId] = useState(summary.id);
  const requestRef = useRef(0);
  const canCorrect = Boolean(onCorrected);
  const current = loaded?.memberId === summary.id ? loaded : null;
  const history = current?.history ?? null;
  const historyStatus = current?.status ?? "loading";

  // Opening a different member drops the old history, the list toggles and any open dialog.
  if (viewedMemberId !== summary.id) {
    setViewedMemberId(summary.id);
    setLoaded(null);
    setShowAllEvents(false);
    setShowAllAudit(false);
    setDialog(null);
  }

  useEffect(() => {
    if (!canCorrect) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const memberId = summary.id;
    void Promise.resolve()
      .then(() => listStampHistory(memberId))
      .then((result) => {
        if (requestId !== requestRef.current) return;
        setLoaded(
          result.status === "ok"
            ? { memberId, status: "ok", history: result.history }
            : { memberId, status: "error", history: null },
        );
      })
      .catch(() => {
        if (requestId !== requestRef.current) return;
        setLoaded({ memberId, status: "error", history: null });
      });
    // Reload whenever the summary object changes: every stamp, claim or
    // correction reloads the summary first.
  }, [summary, canCorrect]);

  const today = history?.today ?? jakartaDateISO();
  // A new stamp may go anywhere from sign-up to today; the dialog works out the period.
  const periodOpen = (history?.origin ?? summary.cycleStart) <= today;
  const currentStart = history?.cycleStart ?? summary.cycleStart;
  const stampEvent = (stamp: StampHistoryStamp): VisitEvent => ({
    id: stamp.id,
    at: `${stamp.visitDate}T23:59:59|${stamp.createdAt}`,
    title: stamp.serviceName,
    meta: stamp.voidedAt
      ? `${formatMemberDate(stamp.visitDate)} · Dihapus${stamp.voidedByName ? ` oleh ${firstName(stamp.voidedByName)}` : ""}`
      : `${formatMemberDate(stamp.visitDate)} · Walk-in${stamp.createdByName ? ` · ${firstName(stamp.createdByName)}` : ""}`,
    aside: stamp.voidedAt ? "Dihapus" : "+1 stamp",
    stamp,
    voided: Boolean(stamp.voidedAt),
  });

  const stampEvents: VisitEvent[] = history
    ? history.stamps.filter((stamp) => stamp.cycleStart === currentStart).map(stampEvent)
    : summary.stamps.map((stamp) => ({
        id: stamp.id,
        at: `${stamp.visitDate}T23:59:59|${stamp.createdAt}`,
        title: stamp.serviceName,
        meta: `${formatMemberDate(stamp.visitDate)} · Walk-in${stamp.createdByName ? ` · ${firstName(stamp.createdByName)}` : ""}`,
        aside: "+1 stamp",
      }));

  // Earlier periods, newest first, each with its own stamps and claims.
  const pastPeriods = history
    ? history.periods
        .filter((item) => !item.current)
        .map((item) => ({
          period: item,
          events: history.stamps
            .filter((stamp) => stamp.cycleStart === item.cycleStart)
            .map(stampEvent)
            .sort(byNewest),
        }))
        .filter((group) => group.events.length > 0 || group.period.claims.length > 0)
        .reverse()
    : [];

  const events: VisitEvent[] = [
    ...stampEvents,
    ...summary.claims.map((claim) => ({
      id: claim.id,
      at: `${jakartaDateISO(new Date(claim.claimedAt))}T23:59:59|${claim.claimedAt}`,
      title: claim.serviceName || claim.rewardName,
      meta: `${formatMemberDate(claim.claimedAt)} · Reward ${claim.milestone}×${claim.claimedByName ? ` · ${firstName(claim.claimedByName)}` : ""}`,
      aside: "Diklaim",
    })),
    ...summary.birthdayRedemptions.map((redemption) => ({
      id: redemption.id,
      at: `${jakartaDateISO(new Date(redemption.redeemedAt))}T23:59:59|${redemption.redeemedAt}`,
      title: redemption.serviceName || "Diskon ulang tahun",
      meta: `${formatMemberDate(redemption.redeemedAt)} · Ulang tahun`,
      aside: "Dipakai",
    })),
  ].sort(byNewest);

  const renderEvent = (event: VisitEvent) => (
    <EventRow
      key={event.id}
      event={event}
      canCorrect={canCorrect}
      editable={Boolean(canCorrect && event.stamp && !event.voided && history != null)}
      onPick={(mode) => setDialog({ mode, stamp: event.stamp ?? null })}
    />
  );

  const shownEvents = showAllEvents ? events : events.slice(0, VISIBLE_EVENTS);
  const audit = history?.audit ?? [];
  const shownAudit = showAllAudit ? audit : audit.slice(0, VISIBLE_AUDIT);

  return (
    <section>
      <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Riwayat kunjungan</h3>
        {canCorrect && periodOpen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 sm:h-8"
            disabled={services.length === 0 || historyStatus !== "ok"}
            onClick={() => setDialog({ mode: "add", stamp: null })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Tambah stamp lama
          </Button>
        ) : null}
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada kunjungan.</p>
      ) : (
        <ul>
          {shownEvents.map(renderEvent)}
        </ul>
      )}
      {events.length > VISIBLE_EVENTS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mt-1 h-11 sm:h-8"
          onClick={() => setShowAllEvents((value) => !value)}
        >
          {showAllEvents ? "Tampilkan lebih sedikit" : `Lihat semua (${events.length})`}
        </Button>
      ) : null}
      {pastPeriods.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">Periode lalu</h4>
          {pastPeriods.map(({ period, events: periodEvents }) => (
            <details key={period.cycleStart} className="group rounded-lg border border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block font-medium">{periodLabel(period)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {period.stampCount} stamp
                    {period.claims.length > 0
                      ? ` · Reward ${period.claims.map((claim) => `${claim.milestone}×`).join(", ")} diklaim`
                      : ""}
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <ul className="border-t border-border px-3 py-1">
                {periodEvents.length === 0 ? (
                  <li className="py-1.5 text-sm text-muted-foreground">Belum ada stamp.</li>
                ) : (
                  periodEvents.map(renderEvent)
                )}
              </ul>
            </details>
          ))}
        </div>
      ) : null}
      {canCorrect && historyStatus === "error" ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Stamp yang dihapus dan riwayat koreksi gagal dimuat. Koreksi belum bisa dipakai.
        </p>
      ) : null}

      {canCorrect && audit.length > 0 ? (
        <div className="mt-5">
          <h4 className="mb-1 text-sm font-medium">Riwayat koreksi</h4>
          <ul>
            {shownAudit.map((row) => {
              const who = row.changedByName ? firstName(row.changedByName) : row.changedByEmail;
              const role = roleLabel(row.changedByRole);
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <div className="min-w-0">
                    <p className="break-words">
                      {stampAuditSummary(row)}
                      {row.cycleStart && row.cycleStart !== currentStart ? (
                        <span className="text-muted-foreground"> · periode lalu</span>
                      ) : null}
                    </p>
                    {row.reason ? (
                      <p className="break-words text-xs text-muted-foreground">Alasan: {row.reason}</p>
                    ) : null}
                    {levelChangeNote(row.tierBefore, row.tierAfter) ? (
                      <p className="text-xs text-muted-foreground">{levelChangeNote(row.tierBefore, row.tierAfter)}</p>
                    ) : null}
                    {row.claimsKept.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Reward {row.claimsKept.map((claim) => `${claim.milestone}×`).join(", ")} tetap tercatat diklaim.
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatMemberDate(row.createdAt)}
                      {who ? ` · ${who}` : ""}
                      {role ? ` (${role})` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatMemberTime(row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
          {audit.length > VISIBLE_AUDIT ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mt-1 h-11 sm:h-8"
              onClick={() => setShowAllAudit((value) => !value)}
            >
              {showAllAudit ? "Tampilkan lebih sedikit" : `Lihat semua koreksi (${audit.length})`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canCorrect ? (
        <StampCorrectionDialog
          open={dialog != null}
          mode={dialog?.mode ?? "add"}
          stamp={dialog?.stamp ?? null}
          memberId={summary.id}
          services={services}
          history={
            history ?? {
              origin: summary.cycleStart,
              cycleStart: summary.cycleStart,
              resetOn: summary.resetOn,
              today,
              periods: [],
            }
          }
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onDone={(message) => onCorrected?.(message)}
        />
      ) : null}
    </section>
  );
}

function StampRowMenu({
  stamp,
  onPick,
}: {
  stamp: StampHistoryStamp;
  onPick: (mode: StampCorrectionMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 shrink-0 sm:size-9"
          aria-label={`Koreksi stamp ${stamp.serviceName} ${formatMemberDate(stamp.visitDate)}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem className="min-h-11 sm:min-h-9" onSelect={() => onPick("service")}>
          Ganti treatment
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 sm:min-h-9" onSelect={() => onPick("date")}>
          Ganti tanggal
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-11 sm:min-h-9"
          onSelect={() => onPick("void")}
        >
          Hapus stamp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function byNewest(left: { at: string }, right: { at: string }) {
  return left.at < right.at ? 1 : left.at > right.at ? -1 : 0;
}

function EventRow({
  event,
  canCorrect,
  editable,
  onPick,
}: {
  event: VisitEvent;
  canCorrect: boolean;
  editable: boolean;
  onPick: (mode: StampCorrectionMode) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <div className="min-w-0 flex-1">
        <p
          className={
            event.voided
              ? "truncate font-medium text-muted-foreground line-through decoration-muted-foreground/60"
              : "truncate font-medium"
          }
        >
          {event.title}
        </p>
        <p className="text-xs text-muted-foreground">{event.meta}</p>
      </div>
      {event.voided ? (
        <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          {event.aside}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{event.aside}</span>
      )}
      {canCorrect ? (
        editable && event.stamp ? (
          <StampRowMenu stamp={event.stamp} onPick={onPick} />
        ) : (
          <span className="size-11 shrink-0 sm:size-9" aria-hidden="true" />
        )
      ) : null}
    </li>
  );
}

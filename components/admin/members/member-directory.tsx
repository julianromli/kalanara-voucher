"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminSurface,
} from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBuyerPhone } from "@/lib/admin/buyer-phone";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import type { MemberListRow } from "@/lib/membership/list";
import { formatMemberDate } from "@/lib/membership/format";
import { whatsAppLink } from "@/lib/membership/templates";
import { TierPill } from "@/components/member/tier-pill";

const TIER_FILTERS = [
  { id: "all", label: "Semua" },
  { id: "0", label: "Member" },
  { id: "1", label: "Bronze" },
  { id: "2", label: "Silver" },
  { id: "3", label: "Gold" },
] as const;

interface MemberDirectoryProps {
  page: AdminPage<MemberListRow>;
  followUp: { nearReward: MemberListRow[]; frequent: MemberListRow[] };
  query: string;
  onQueryChange: (value: string) => void;
  tier: string;
  onTierChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (memberId: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

function followUpReason(row: MemberListRow, kind: "near" | "frequent"): string {
  if (kind === "near") {
    const target = row.nextMilestone ?? row.stampCount + 1;
    const reward = row.nextRewardName?.trim();
    return reward ? `1 stamp lagi buat ${reward}` : `1 stamp lagi ke stamp ke-${target}`;
  }
  return `${row.stampCount} stamp periode ini`;
}

function followUpWaText(row: MemberListRow, kind: "near" | "frequent"): string {
  const first = row.name.split(" ")[0] || row.name;
  if (kind === "near") {
    const reward = row.nextRewardName?.trim();
    if (reward) {
      return `Halo ${first}, tinggal 1 stamp lagi buat ${reward} di Kalanara. Mau atur jadwal?`;
    }
    const target = row.nextMilestone ?? row.stampCount + 1;
    return `Halo ${first}, tinggal 1 stamp lagi ke stamp ke-${target} di Kalanara. Mau atur jadwal?`;
  }
  return `Halo ${first}, kamu sudah ${row.stampCount} stamp periode ini di Kalanara. Mau treatment lagi?`;
}

function peopleCount(count: number): string {
  return `${count} orang`;
}

function FollowUpRow({
  row,
  kind,
  onSelect,
}: {
  row: MemberListRow;
  kind: "near" | "frequent";
  onSelect: (memberId: string) => void;
}) {
  const reason = followUpReason(row, kind);
  const waHref = row.waConsent ? whatsAppLink(row.phone, followUpWaText(row, kind)) : null;
  const lastVisit = row.lastVisitAt
    ? `Terakhir ${formatMemberDate(row.lastVisitAt)}`
    : "Belum ada kunjungan";

  return (
    <li className="flex items-start gap-2 py-2.5">
      <button
        type="button"
        onClick={() => onSelect(row.id)}
        className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{row.name}</span>
          <TierPill tier={row.effectiveTier} />
        </span>
        <span className="mt-1 block text-sm text-pretty text-foreground">{reason}</span>
        <span className="mt-1 block text-xs text-pretty text-muted-foreground">
          {formatBuyerPhone(row.phone)}
          {" · "}
          {lastVisit}
          {" · "}
          <span className="tabular-nums">{row.stampCount} stamp</span>
        </span>
      </button>
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2.5 text-sm font-medium text-foreground outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Buka WhatsApp ${row.name}`}
        >
          WhatsApp
        </a>
      ) : null}
    </li>
  );
}

function FollowUpGroup({
  title,
  rows,
  kind,
  onSelect,
}: {
  title: string;
  rows: MemberListRow[];
  kind: "near" | "frequent";
  onSelect: (memberId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="px-2 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <FollowUpRow key={`${kind}-${row.id}`} row={row} kind={kind} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div role="status" aria-label="Memuat daftar member">
      <span className="sr-only">Memuat daftar member…</span>
      <div className="space-y-3 p-4 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-md bg-muted motion-safe:animate-pulse" />
                <div className="h-3 w-28 rounded-md bg-muted motion-safe:animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="mt-3 h-3 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <div className="h-3 w-48 rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3">
            <div className="h-4 w-[22%] rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-[22%] rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-5 w-14 rounded-full bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-10 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-4 flex-1 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectoryTable({
  rows,
  onSelect,
}: {
  rows: MemberListRow[];
  onSelect: (memberId: string) => void;
}) {
  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="block w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatBuyerPhone(row.phone)}</p>
              </div>
              <TierPill tier={row.effectiveTier} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums text-foreground">{row.stampCount} stamp</span>
              <span>{row.lastVisitAt ? formatMemberDate(row.lastVisitAt) : "Belum ada kunjungan"}</span>
              <span>Sejak {formatMemberDate(row.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="w-full table-fixed" aria-label="Daftar member">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-[26%] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:w-[22%]">Nama</th>
              <th className="w-[26%] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:w-[22%]">WhatsApp</th>
              <th className="w-[16%] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:w-[12%]">Level</th>
              <th className="w-[10%] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:w-[8%]">Stamp</th>
              <th className="w-[22%] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:w-[18%]">Terakhir</th>
              <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground xl:table-cell xl:w-[18%]">Member sejak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => onSelect(row.id)}
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    aria-label={`Buka kartu ${row.name}`}
                    className="block w-full truncate text-left text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-sm text-foreground">
                  {formatBuyerPhone(row.phone)}
                </td>
                <td className="px-4 py-2.5">
                  <TierPill tier={row.effectiveTier} />
                </td>
                <td className="px-4 py-2.5 text-sm tabular-nums">{row.stampCount}</td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground">
                  {row.lastVisitAt ? formatMemberDate(row.lastVisitAt) : "—"}
                </td>
                <td className="hidden px-4 py-2.5 text-sm text-muted-foreground xl:table-cell">
                  {formatMemberDate(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MemberDirectory({
  page,
  followUp,
  query,
  onQueryChange,
  tier,
  onTierChange,
  onPageChange,
  onSelect,
  loading = false,
  error = false,
  onRetry,
}: MemberDirectoryProps) {
  const rows = page.rows;
  const followUpCount = followUp.nearReward.length + followUp.frequent.length;
  const showFollowUp =
    !query.trim() &&
    tier === "all" &&
    followUpCount > 0;
  const showPager = !error && page.totalCount > 0 && !(loading && rows.length === 0);

  return (
    <div className="min-w-0 space-y-5">
      {showFollowUp ? (
        <section aria-labelledby="siap-follow-up-heading" className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="siap-follow-up-heading" className="text-sm font-semibold">
              Siap follow up
            </h2>
            <p className="text-sm text-muted-foreground tabular-nums">{peopleCount(followUpCount)}</p>
          </div>
          <AdminSurface className="space-y-4">
            <FollowUpGroup
              title="Deket reward"
              rows={followUp.nearReward}
              kind="near"
              onSelect={onSelect}
            />
            <FollowUpGroup
              title="Sering datang"
              rows={followUp.frequent}
              kind="frequent"
              onSelect={onSelect}
            />
          </AdminSurface>
        </section>
      ) : null}

      <section aria-labelledby="semua-member-heading" className="space-y-3">
        <h2 id="semua-member-heading" className="text-sm font-semibold">
          Semua member
        </h2>
        <AdminSurface className="space-y-3">
          <AdminFilterBar>
            <div className="relative flex-1">
              <label htmlFor="member-directory-search" className="sr-only">
                Cari nama atau nomor HP
              </label>
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="member-directory-search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Cari nama atau nomor HP"
                className="h-11 pl-10"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </AdminFilterBar>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter level">
            {TIER_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tier === item.id}
                onClick={() => onTierChange(item.id)}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                  tier === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </AdminSurface>
        {error ? (
          <AdminSurface padded={false}>
            <AdminEmptyState
              icon={<HugeiconsIcon icon={UserGroupIcon} size={22} />}
              title="Daftar member gagal dimuat"
              description="Coba muat ulang. Kalau masih gagal, cek koneksi dulu."
            >
              {onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry}>
                  Coba lagi
                </Button>
              ) : null}
            </AdminEmptyState>
          </AdminSurface>
        ) : rows.length === 0 && !loading ? (
          <AdminSurface padded={false}>
            <AdminEmptyState
              icon={<HugeiconsIcon icon={UserGroupIcon} size={22} />}
              title={query.trim() || tier !== "all" ? "Tidak ada member" : "Belum ada member"}
              description={
                query.trim() || tier !== "all"
                  ? "Coba nama, nomor, atau filter level yang lain."
                  : "Member yang didaftarkan muncul di sini."
              }
            />
          </AdminSurface>
        ) : (
          <>
            <AdminSurface
              padded={false}
              className={loading ? "min-w-0 overflow-x-auto opacity-70" : "min-w-0 overflow-x-auto"}
            >
              {loading && rows.length === 0 ? (
                <DirectorySkeleton />
              ) : (
                <DirectoryTable rows={rows} onSelect={onSelect} />
              )}
            </AdminSurface>
            {showPager || (loading && page.totalCount > 0) ? (
              <AdminListPagination
                itemLabel="member"
                page={page.page}
                pageSize={page.pageSize}
                totalCount={page.totalCount}
                totalPages={page.totalPages}
                onPageChange={onPageChange}
                disabled={loading}
                className="border-0 px-0 pt-1"
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

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

function MemberRowButton({
  row,
  subtitle,
  onSelect,
}: {
  row: MemberListRow;
  subtitle: string;
  onSelect: (memberId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{row.name}</span>
          <TierPill tier={row.effectiveTier} />
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {formatBuyerPhone(row.phone)} · {subtitle}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {row.stampCount} stamp
      </span>
    </button>
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
                <p className="truncate font-medium text-foreground">{row.name}</p>
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
              <th className="w-[26%] p-3 text-left text-sm font-medium text-muted-foreground xl:w-[22%] lg:p-4">Nama</th>
              <th className="w-[26%] p-3 text-left text-sm font-medium text-muted-foreground xl:w-[22%] lg:p-4">WhatsApp</th>
              <th className="w-[16%] p-3 text-left text-sm font-medium text-muted-foreground xl:w-[12%] lg:p-4">Level</th>
              <th className="w-[10%] p-3 text-left text-sm font-medium text-muted-foreground xl:w-[8%] lg:p-4">Stamp</th>
              <th className="w-[22%] p-3 text-left text-sm font-medium text-muted-foreground xl:w-[18%] lg:p-4">Terakhir</th>
              <th className="hidden p-3 text-left text-sm font-medium text-muted-foreground xl:table-cell xl:w-[18%] lg:p-4">Member sejak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="relative transition-colors hover:bg-muted/30"
              >
                <td className="p-3 lg:p-4">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-label={`Buka kartu ${row.name}`}
                    className="block w-full truncate text-left font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="p-3 text-sm text-foreground lg:p-4">
                  {formatBuyerPhone(row.phone)}
                </td>
                <td className="p-3 lg:p-4">
                  <TierPill tier={row.effectiveTier} />
                </td>
                <td className="p-3 text-sm tabular-nums lg:p-4">{row.stampCount}</td>
                <td className="p-3 text-sm text-muted-foreground lg:p-4">
                  {row.lastVisitAt ? formatMemberDate(row.lastVisitAt) : "—"}
                </td>
                <td className="hidden p-3 text-sm text-muted-foreground xl:table-cell lg:p-4">
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
  const showFollowUp =
    !query.trim() &&
    tier === "all" &&
    (followUp.nearReward.length > 0 || followUp.frequent.length > 0);
  const rows = page.rows;

  return (
    <div className="min-w-0 space-y-5">
      {showFollowUp ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Siap follow up</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Member yang deket reward, plus yang paling sering datang. Ajak mereka treatment lagi.
            </p>
          </div>
          <AdminSurface padded={false}>
            {followUp.nearReward.length > 0 ? (
              <div className="px-2 py-2">
                <h3 className="px-2 pt-2 text-xs font-medium text-muted-foreground">Deket reward</h3>
                <ul className="mt-1">
                  {followUp.nearReward.map((row) => (
                    <li key={row.id}>
                      <MemberRowButton
                        row={row}
                        subtitle={followUpReason(row, "near")}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {followUp.frequent.length > 0 ? (
              <div className="px-2 py-2">
                <h3 className="px-2 pt-2 text-xs font-medium text-muted-foreground">Sering datang</h3>
                <ul className="mt-1">
                  {followUp.frequent.map((row) => (
                    <li key={row.id}>
                      <MemberRowButton
                        row={row}
                        subtitle={followUpReason(row, "frequent")}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </AdminSurface>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Semua member</h2>
        <AdminSurface>
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
          <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Filter level">
            {TIER_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tier === item.id}
                onClick={() => onTierChange(item.id)}
                className={`h-8 rounded-full px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
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
          <AdminSurface padded={false} className={loading ? "min-w-0 overflow-x-auto opacity-70" : "min-w-0 overflow-x-auto"}>
            {loading && rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Memuat daftar member…</p>
            ) : (
              <>
                <DirectoryTable rows={rows} onSelect={onSelect} />
                <AdminListPagination
                  itemLabel="member"
                  page={page.page}
                  totalCount={page.totalCount}
                  totalPages={page.totalPages}
                  onPageChange={onPageChange}
                  disabled={loading}
                />
              </>
            )}
          </AdminSurface>
        )}
      </section>
    </div>
  );
}


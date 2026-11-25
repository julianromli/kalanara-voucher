import { normalizeMemberPhone } from "@/lib/membership/phone";
import {
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
import {
  MILESTONES,
  effectiveTier,
  rollCycle,
} from "@/lib/membership/rules";

export const NEAR_REWARD_LIMIT = 8;
export const FREQUENT_VISITOR_LIMIT = 5;

export interface MemberListStamp {
  cycleStart: string;
  visitAt: string;
  voided: boolean;
}

export interface MemberListRecord {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  baseTier: number;
  cycleStart: string;
  stamps: MemberListStamp[];
}

export interface MemberListRow {
  id: string;
  name: string;
  phone: string;
  effectiveTier: number;
  stampCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  nextMilestone: number | null;
  nextRewardName: string | null;
}

export interface MemberFollowUpGroups {
  nearReward: MemberListRow[];
  frequent: MemberListRow[];
}

export function configuredRewardMilestones(
  rewards: Array<{ milestone: number; name: string | null | undefined }>,
): number[] {
  const named = rewards
    .filter((row) => (row.name ?? "").trim().length > 0)
    .map((row) => row.milestone)
    .sort((left, right) => left - right);
  return named.length > 0 ? named : [...MILESTONES];
}

export function buildMemberListRow(
  record: MemberListRecord,
  today: string,
  rewardNames: Map<number, string>,
): MemberListRow {
  const stampsByCycle: Record<string, number> = {};
  let lastVisitAt: string | null = null;
  for (const stamp of record.stamps) {
    if (stamp.voided) continue;
    stampsByCycle[stamp.cycleStart] = (stampsByCycle[stamp.cycleStart] ?? 0) + 1;
    if (!lastVisitAt || stamp.visitAt > lastVisitAt) lastVisitAt = stamp.visitAt;
  }
  const rolled = rollCycle({
    cycleStart: record.cycleStart,
    baseTier: record.baseTier,
    today,
    stampsByCycle,
  });
  const nextMilestone =
    configuredRewardMilestones(
      [...rewardNames.entries()].map(([milestone, name]) => ({ milestone, name })),
    ).find((milestone) => milestone > rolled.stampCount) ?? null;

  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    effectiveTier: effectiveTier(rolled.stampCount, rolled.baseTier),
    stampCount: rolled.stampCount,
    lastVisitAt,
    createdAt: record.createdAt,
    nextMilestone,
    nextRewardName: nextMilestone ? rewardNames.get(nextMilestone) ?? null : null,
  };
}

export function isNearReward(row: MemberListRow, milestones: number[]): boolean {
  return milestones.some((milestone) => row.stampCount === milestone - 1);
}

export function compareMemberListRows(left: MemberListRow, right: MemberListRow): number {
  if (left.lastVisitAt && right.lastVisitAt && left.lastVisitAt !== right.lastVisitAt) {
    return right.lastVisitAt.localeCompare(left.lastVisitAt);
  }
  if (left.lastVisitAt && !right.lastVisitAt) return -1;
  if (!left.lastVisitAt && right.lastVisitAt) return 1;
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }
  return left.name.localeCompare(right.name, "id");
}

export function pickFollowUpMembers(
  rows: MemberListRow[],
  milestones: number[],
  options: { nearLimit?: number; frequentLimit?: number } = {},
): MemberFollowUpGroups {
  const nearLimit = options.nearLimit ?? NEAR_REWARD_LIMIT;
  const frequentLimit = options.frequentLimit ?? FREQUENT_VISITOR_LIMIT;
  const nearReward = rows
    .filter((row) => isNearReward(row, milestones))
    .sort(compareMemberListRows)
    .slice(0, nearLimit);
  const nearIds = new Set(nearReward.map((row) => row.id));
  const frequent = rows
    .filter((row) => row.stampCount > 0 && !nearIds.has(row.id))
    .sort((left, right) => {
      if (left.stampCount !== right.stampCount) return right.stampCount - left.stampCount;
      return compareMemberListRows(left, right);
    })
    .slice(0, frequentLimit);
  return { nearReward, frequent };
}

export function memberListQueryMatches(row: MemberListRow, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (row.name.toLowerCase().includes(trimmed.toLowerCase())) return true;
  const digits = trimmed.replace(/\D/g, "");
  const phone = normalizeMemberPhone(trimmed);
  if (phone && row.phone === phone) return true;
  if (digits.length >= 3 && row.phone.includes(digits)) return true;
  return false;
}

export function filterMemberList(
  rows: MemberListRow[],
  input: { query: string; tier: string },
): MemberListRow[] {
  const tierFilter = input.tier === "all" ? null : Number(input.tier);
  return rows
    .filter((row) => memberListQueryMatches(row, input.query))
    .filter((row) => tierFilter == null || Number.isNaN(tierFilter) || row.effectiveTier === tierFilter)
    .sort(compareMemberListRows);
}

export function paginateMemberList(
  rows: MemberListRow[],
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
): AdminPage<MemberListRow> {
  const safePage = page > 0 ? page : 1;
  const from = (safePage - 1) * pageSize;
  return buildAdminPage(rows.slice(from, from + pageSize), safePage, rows.length);
}

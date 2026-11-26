import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";
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
  waConsent: boolean;
  stamps: MemberListStamp[];
  /** Reward claims of any period; only the current period's count. */
  claims?: Array<{ cycleStart: string; milestone: number }>;
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
  waConsent: boolean;
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
  // A reward already claimed in this period is done, even when a stamp void
  // dropped the count back under it, so aim at the next unclaimed one.
  const claimed = new Set(
    (record.claims ?? [])
      .filter((claim) => claim.cycleStart === rolled.cycleStart)
      .map((claim) => claim.milestone),
  );
  const nextMilestone =
    configuredRewardMilestones(
      [...rewardNames.entries()].map(([milestone, name]) => ({ milestone, name })),
    ).find((milestone) => milestone > rolled.stampCount && !claimed.has(milestone)) ?? null;

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
    waConsent: record.waConsent,
  };
}

/** One stamp away from the next unclaimed configured reward. */
export function isNearReward(row: MemberListRow, milestones: number[]): boolean {
  return (
    row.nextMilestone != null &&
    row.nextMilestone === row.stampCount + 1 &&
    milestones.includes(row.nextMilestone)
  );
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
  const exact = normalizeMemberPhone(trimmed);
  if (exact && row.phone === exact) return true;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 3) return false;
  // Same prefix cleanup as normalizeMemberPhone, then the buyer normalizer so
  // partial 08… / +62 / 62 / 8… queries line up with stored 62… numbers.
  let rest = digits;
  if (rest.startsWith("00")) rest = rest.slice(2);
  if (rest.startsWith("62") && rest.charAt(2) === "0") rest = `62${rest.slice(3)}`;
  const normalized = normalizeBuyerPhone(rest);
  if (normalized.length >= 3 && row.phone.includes(normalized)) return true;
  if (rest !== normalized && rest.length >= 3 && row.phone.includes(rest)) return true;
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
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  return buildAdminPage(rows.slice(from, from + pageSize), safePage, rows.length);
}

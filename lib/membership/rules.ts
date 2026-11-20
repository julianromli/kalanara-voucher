export const STAMP_CAP = 30;
export const MILESTONES = [5, 10, 15, 20, 25, 30] as const;
export const FOLLOWUP_STAGES = ["day30", "day60", "day90", "day120"] as const;

export type Tier = 0 | 1 | 2 | 3;
export type Milestone = (typeof MILESTONES)[number];
export type FollowupStage = (typeof FOLLOWUP_STAGES)[number] | "birthday";
export type RewardState = "locked" | "ready" | "unconfigured" | "claimed";

export interface BirthdayWindow {
  occurrence: string;
  birthdayYear: number;
  windowStart: string;
  windowEnd: string;
  inWindow: boolean;
}

export interface RolledCycle {
  cycleStart: string;
  baseTier: Tier;
  stampCount: number;
  rolledCycles: number;
  tierBefore: Tier | null;
}

const TIER_NAMES = ["Member", "Bronze", "Silver", "Gold"] as const;

export function clampTier(value: number): Tier {
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  if (value >= 1) return 1;
  return 0;
}

export function tierFromStamps(count: number): Tier {
  if (count >= 30) return 3;
  if (count >= 20) return 2;
  if (count >= 10) return 1;
  return 0;
}

export function effectiveTier(stampCount: number, baseTier: number): Tier {
  return clampTier(Math.max(tierFromStamps(stampCount), clampTier(baseTier)));
}

export function tierName(tier: number): (typeof TIER_NAMES)[number] {
  return TIER_NAMES[clampTier(tier)];
}

export function tierBenefitLabel(tier: number): string | null {
  if (clampTier(tier) === 2) return "diskon 5%*";
  if (clampTier(tier) === 3) return "diskon 10%*";
  return null;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatISODate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function diffDays(later: string, earlier: string): number {
  const ms = parseISODate(later).getTime() - parseISODate(earlier).getTime();
  return Math.round(ms / 86_400_000);
}

export function addMonths(value: string, months: number): string {
  const date = parseISODate(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatISODate(target);
}

export function nextResetDate(cycleStart: string): string {
  return addMonths(cycleStart, 12);
}

export function rollCycle(input: {
  cycleStart: string;
  baseTier: number;
  today: string;
  stampsByCycle?: Record<string, number>;
}): RolledCycle {
  let cycleStart = input.cycleStart;
  let baseTier = clampTier(input.baseTier);
  let rolledCycles = 0;
  let tierBefore: Tier | null = null;
  let stampCount = input.stampsByCycle?.[cycleStart] ?? 0;

  while (input.today >= nextResetDate(cycleStart)) {
    stampCount = input.stampsByCycle?.[cycleStart] ?? 0;
    const effective = effectiveTier(stampCount, baseTier);
    if (rolledCycles === 0) {
      tierBefore = effective;
    }
    baseTier = clampTier(effective - 1);
    cycleStart = nextResetDate(cycleStart);
    rolledCycles += 1;
    if (rolledCycles > 200) {
      break;
    }
  }

  stampCount = input.stampsByCycle?.[cycleStart] ?? 0;
  return {
    cycleStart,
    baseTier,
    stampCount,
    rolledCycles,
    tierBefore,
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function birthdayOccurrence(birthDate: string, year: number): string {
  const [, monthText, dayText] = birthDate.slice(0, 10).split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return `${year}-02-28`;
  }
  return `${year}-${monthText}-${dayText}`;
}

export function birthdayWindow(birthDate: string, today: string): BirthdayWindow {
  const year = Number(today.slice(0, 4));
  const candidates = [year - 1, year, year + 1].map((candidateYear) =>
    birthdayOccurrence(birthDate, candidateYear),
  );
  let occurrence = candidates[0];
  let bestDistance = Math.abs(diffDays(occurrence, today));

  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(diffDays(candidate, today));
    const preferUpcoming =
      distance === bestDistance && candidate >= today && occurrence < today;
    if (distance < bestDistance || preferUpcoming) {
      occurrence = candidate;
      bestDistance = distance;
    }
  }

  const windowStart = addDays(occurrence, -7);
  const windowEnd = addDays(occurrence, 7);
  return {
    occurrence,
    birthdayYear: Number(occurrence.slice(0, 4)),
    windowStart,
    windowEnd,
    inWindow: today >= windowStart && today <= windowEnd,
  };
}

export function followupStage(daysSince: number | null): FollowupStage | null {
  if (daysSince == null || daysSince < 30) return null;
  if (daysSince < 60) return "day30";
  if (daysSince < 90) return "day60";
  if (daysSince < 120) return "day90";
  return "day120";
}

export function rewardState(input: {
  stampCount: number;
  milestone: number;
  name: string | null;
  claimed: boolean;
}): RewardState {
  if (input.claimed) return "claimed";
  if (input.stampCount < input.milestone) return "locked";
  if (!input.name) return "unconfigured";
  return "ready";
}

export function nextOpenMilestone(stampCount: number): Milestone | null {
  return MILESTONES.find((milestone) => milestone > stampCount) ?? null;
}

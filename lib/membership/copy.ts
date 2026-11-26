import { formatMemberDate, firstName, jakartaDateISO } from "@/lib/membership/format";
import {
  effectiveTier,
  nextOpenMilestone,
  rewardState,
  tierBenefitLabel,
  tierFromStamps,
  tierName,
  type Tier,
} from "@/lib/membership/rules";
import type { MemberRewardView, MemberSummary } from "@/lib/membership/summary";

/**
 * Next milestone above the count that is not claimed yet. A stamp void can
 * leave a claimed reward above the count; that reward is done, so progress
 * and follow-up messages point at the next unclaimed one instead.
 */
export function nextUnclaimedMilestone(
  summary: Pick<MemberSummary, "stampCount" | "rewards">,
): number | null {
  const claimed = new Set(
    summary.rewards.filter((reward) => reward.claimId).map((reward) => reward.milestone),
  );
  let next: number | null = nextOpenMilestone(summary.stampCount);
  while (next != null && claimed.has(next)) next = nextOpenMilestone(next);
  return next;
}

export function progressCopy(summary: MemberSummary): { title: string; detail: string } {
  if (summary.stampCount >= 30) {
    const nextTier = tierName(Math.max(summary.effectiveTier - 1, 0));
    return {
      title: "Stamp penuh",
      detail: `Stamp mulai lagi dari 0 tanggal ${formatMemberDate(summary.resetOn)}. Level turun ke ${nextTier}.`,
    };
  }

  const next = nextUnclaimedMilestone(summary);
  if (next == null) {
    return { title: `${summary.stampCount} stamp`, detail: "" };
  }

  const reward = summary.rewards.find((item) => item.milestone === next);
  const remaining = next - summary.stampCount;
  if (reward?.name) {
    return {
      title: `${remaining} stamp lagi buat ${reward.name}`,
      detail: promotionDetail(summary, next),
    };
  }

  return {
    title: `Berikutnya: ${next} stamp`,
    detail: "Reward-nya belum diatur admin.",
  };
}

function promotionDetail(summary: MemberSummary, milestone: number): string {
  const projected = effectiveTier(milestone, summary.baseTier);
  if (projected <= summary.effectiveTier) return "";
  if (tierFromStamps(milestone) === 1) return "Sekalian naik ke Bronze di 10 stamp.";
  if (tierFromStamps(milestone) === 2) return "Sekalian naik ke Silver di 20 stamp.";
  if (tierFromStamps(milestone) === 3) return "Sekalian naik ke Gold di 30 stamp.";
  return "";
}

function levelNoteFor(summary: MemberSummary, milestone: number): string {
  const projected = effectiveTier(milestone, summary.baseTier);
  if (projected <= summary.effectiveTier) return "";
  if (milestone === 10) return "naik ke Bronze";
  if (milestone === 20) return `naik ke Silver (${tierBenefitLabel(2)})`;
  if (milestone === 30) return `naik ke Gold (${tierBenefitLabel(3)})`;
  return "";
}

export function cashierRewardLabel(
  summary: MemberSummary,
  reward: MemberRewardView,
): { text: string | null; canClaim: boolean } {
  const state = rewardState({
    stampCount: summary.stampCount,
    milestone: reward.milestone,
    name: reward.name,
    claimed: Boolean(reward.claimId),
  });

  if (state === "claimed") {
    const when = reward.claimedAt ? formatMemberDate(reward.claimedAt) : "";
    const who = reward.claimedByName ? firstName(reward.claimedByName) : "kasir";
    return { text: `Diklaim ${when} · ${who}`, canClaim: false };
  }
  if (state === "ready") return { text: null, canClaim: true };
  if (state === "unconfigured") return { text: "Belum diatur", canClaim: false };
  return {
    text: `${reward.milestone - summary.stampCount} stamp lagi`,
    canClaim: false,
  };
}

export function memberRewardCopy(
  summary: MemberSummary,
  reward: MemberRewardView,
): { title: string; detail: string; aside: string; ready: boolean } {
  const state = rewardState({
    stampCount: summary.stampCount,
    milestone: reward.milestone,
    name: reward.name,
    claimed: Boolean(reward.claimId),
  });
  const title = state === "claimed" && reward.claimedName
    ? reward.claimedName
    : reward.name || `Reward ${reward.milestone} stamp`;
  const remaining = Math.max(reward.milestone - summary.stampCount, 0);
  const levelNote = levelNoteFor(summary, reward.milestone);

  if (state === "claimed") {
    const currentLevelReward = summary.effectiveTier === tierFromMilestone(reward.milestone);
    return {
      title,
      detail: currentLevelReward ? "Dipakai · level kamu sekarang" : "Dipakai.",
      aside: "",
      ready: false,
    };
  }

  if (state === "ready") {
    return { title, detail: "Tunjukkan QR ini ke kasir.", aside: "Siap dipakai", ready: true };
  }

  if (reward.name && state === "locked") {
    return {
      title,
      detail: `Kebuka di ${reward.milestone} stamp${levelNote ? ` · ${levelNote}` : ""}.`,
      aside: `${remaining} lagi`,
      ready: false,
    };
  }

  return {
    title,
    detail: `Lagi disiapin Kalanara${levelNote ? ` · ${levelNote}` : ""}.`,
    aside: state === "unconfigured" && summary.stampCount >= reward.milestone
      ? "Lagi disiapin"
      : `${remaining} lagi`,
    ready: false,
  };
}

function tierFromMilestone(milestone: number): Tier {
  if (milestone >= 30) return 3;
  if (milestone >= 20) return 2;
  if (milestone >= 10) return 1;
  return 0;
}

export function resetBanner(summary: MemberSummary): string | null {
  if (summary.rolledCycles < 1 || summary.tierBefore == null) return null;
  const fromTier = summary.tierBefore;
  const toTier = summary.effectiveTier;
  const startLabel =
    summary.cycleStart === jakartaDateISO()
      ? "hari ini"
      : formatMemberDate(summary.cycleStart);
  const freshStart = `Periode baru mulai ${startLabel}. Stamp ${firstName(summary.name)} mulai lagi dari 0`;
  const dropped = fromTier - toTier;
  if (dropped <= 0) return `${freshStart}.`;
  const steps = dropped === 1 ? "satu tingkat" : `${dropped} tingkat`;
  return `${freshStart}, dan level turun ${steps} dari ${tierName(fromTier)} ke ${tierName(toTier)}.`;
}

export interface StampChange {
  openedReward: string | null;
  tierBefore: number | null;
  tierAfter: number | null;
}

/**
 * Banner text for the stamp that was just added. Returns null when the stamp
 * opened nothing and changed no level, so the previous banner clears.
 */
export function stampBanner(change: StampChange, memberName: string): string | null {
  const name = firstName(memberName);
  const after = change.tierAfter;
  const tierUp = after != null && change.tierBefore != null && after > change.tierBefore;
  const newTier = tierUp ? tierName(after) : null;
  if (change.openedReward && newTier) {
    return `${change.openedReward} kebuka, dan ${name} naik ke ${newTier}. Klaim di daftar reward, sekarang atau di kunjungan berikutnya. Stamp nggak berkurang.`;
  }
  if (change.openedReward) {
    return `${change.openedReward} kebuka. Klaim di daftar reward. Stamp nggak berkurang.`;
  }
  if (newTier) {
    return `${name} naik ke ${newTier}.`;
  }
  return null;
}

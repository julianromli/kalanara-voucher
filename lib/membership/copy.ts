import { formatMemberDate, firstName } from "@/lib/membership/format";
import {
  nextOpenMilestone,
  rewardState,
  tierBenefitLabel,
  tierName,
  type Tier,
} from "@/lib/membership/rules";
import type { MemberRewardView, MemberSummary } from "@/lib/membership/summary";

export function progressCopy(summary: MemberSummary): { title: string; detail: string } {
  if (summary.stampCount >= 30) {
    const nextTier = tierName(Math.max(summary.effectiveTier - 1, 0));
    return {
      title: "Stamp penuh",
      detail: `Stamp mulai lagi dari 0 tanggal ${formatMemberDate(summary.resetOn)}. Level turun ke ${nextTier}.`,
    };
  }

  const next = nextOpenMilestone(summary.stampCount);
  if (next == null) {
    return { title: `${summary.stampCount} stamp`, detail: "" };
  }

  const reward = summary.rewards.find((item) => item.milestone === next);
  const remaining = next - summary.stampCount;
  if (reward?.name) {
    return {
      title: `${remaining} stamp lagi buat ${reward.name.toLowerCase()}`,
      detail: tierCrossingDetail(next),
    };
  }

  return {
    title: `Berikutnya: ${next} stamp`,
    detail: "Reward-nya belum diatur admin.",
  };
}

function tierCrossingDetail(milestone: number): string {
  if (milestone === 10) return "Sekalian naik ke Bronze di 10 stamp.";
  if (milestone === 20) return "Sekalian naik ke Silver di 20 stamp.";
  if (milestone === 30) return "Sekalian naik ke Gold di 30 stamp.";
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
  const title = reward.name || `Reward ${reward.milestone} stamp`;
  const remaining = Math.max(reward.milestone - summary.stampCount, 0);
  const levelNote = levelNoteFor(reward.milestone);

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

function levelNoteFor(milestone: number): string {
  if (milestone === 10) return "naik ke Bronze";
  if (milestone === 20) return `naik ke Silver (${tierBenefitLabel(2)})`;
  if (milestone === 30) return `naik ke Gold (${tierBenefitLabel(3)})`;
  return "";
}

export function resetBanner(summary: MemberSummary): string | null {
  if (summary.rolledCycles < 1 || summary.tierBefore == null) return null;
  const from = tierName(summary.tierBefore);
  const to = tierName(summary.effectiveTier);
  const steps =
    summary.rolledCycles === 1
      ? "satu tingkat"
      : `${summary.rolledCycles} tingkat`;
  return `Periode baru mulai hari ini. Stamp ${firstName(summary.name)} mulai lagi dari 0, dan level turun ${steps} dari ${from} ke ${to}.`;
}

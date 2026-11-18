export interface MemberRewardView {
  milestone: number;
  name: string | null;
  note: string | null;
  claimId: string | null;
  claimedName: string | null;
  claimedService: string | null;
  claimedAt: string | null;
  claimedByName: string | null;
}

export interface MemberStampView {
  id: string;
  visitDate: string;
  serviceName: string;
  createdAt: string;
  createdByName: string | null;
}

export interface MemberClaimView {
  id: string;
  milestone: number;
  rewardName: string;
  serviceName: string | null;
  claimedAt: string;
  cycleStart: string;
  claimedByName: string | null;
}

export interface MemberBirthdayRedemptionView {
  id: string;
  birthdayYear: number;
  serviceName: string | null;
  redeemedAt: string;
  redeemedByName: string | null;
}

export interface MemberSummary {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  waConsent: boolean;
  memberCode: string;
  source: "cashier" | "self_signup";
  createdAt: string;
  cardToken: string;
  stampCount: number;
  baseTier: number;
  effectiveTier: number;
  cycleStart: string;
  rolledCycles: number;
  tierBefore: number | null;
  resetOn: string;
  birthday: {
    eligible: boolean;
    redeemed: boolean;
    occurrence: string;
    windowStart: string;
    windowEnd: string;
    birthdayYear: number;
  };
  lastTreatment: {
    date: string;
    serviceName: string;
    kind: string;
  } | null;
  rewards: MemberRewardView[];
  stamps: MemberStampView[];
  claims: MemberClaimView[];
  birthdayRedemptions: MemberBirthdayRedemptionView[];
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseMemberSummary(value: unknown): MemberSummary | null {
  const body = record(value);
  if (!body || body.status !== "ok") return null;
  const member = record(body.member);
  const birthday = record(body.birthday);
  if (!member || !birthday) return null;

  const id = text(member.id);
  const name = text(member.name);
  const phone = text(member.phone);
  const birthDate = text(member.birth_date);
  const memberCode = text(member.member_code);
  const cardToken = text(member.card_token);
  const createdAt = text(member.created_at);
  const source = member.source === "self_signup" ? "self_signup" : "cashier";
  const stampCount = numberValue(body.stamp_count);
  const resetOn = text(body.reset_on);
  const cycleStart = text(body.cycle_start);
  if (
    !id ||
    !name ||
    !phone ||
    !birthDate ||
    !memberCode ||
    !cardToken ||
    !createdAt ||
    stampCount == null ||
    !resetOn ||
    !cycleStart
  ) {
    return null;
  }

  const last = record(body.last_treatment);

  return {
    id,
    name,
    phone,
    birthDate,
    waConsent: member.wa_consent === true,
    memberCode,
    source: member.source === "self_signup" ? source : "cashier",
    createdAt,
    cardToken,
    stampCount,
    baseTier: numberValue(body.base_tier) ?? 0,
    effectiveTier: numberValue(body.effective_tier) ?? 0,
    cycleStart,
    rolledCycles: numberValue(body.rolled_cycles) ?? 0,
    tierBefore: numberValue(body.tier_before),
    resetOn,
    birthday: {
      eligible: birthday.eligible === true,
      redeemed: birthday.redeemed === true,
      occurrence: text(birthday.occurrence) ?? birthDate,
      windowStart: text(birthday.window_start) ?? birthDate,
      windowEnd: text(birthday.window_end) ?? birthDate,
      birthdayYear: numberValue(birthday.birthday_year) ?? 0,
    },
    lastTreatment: last
      ? {
          date: text(last.date) ?? "",
          serviceName: text(last.service_name) ?? "",
          kind: text(last.kind) ?? "stamp",
        }
      : null,
    rewards: list(body.rewards).map((item) => {
      const row = record(item) ?? {};
      return {
        milestone: numberValue(row.milestone) ?? 0,
        name: text(row.name),
        note: text(row.note),
        claimId: text(row.claim_id),
        claimedName: text(row.claimed_name),
        claimedService: text(row.claimed_service),
        claimedAt: text(row.claimed_at),
        claimedByName: text(row.claimed_by_name),
      };
    }),
    stamps: list(body.stamps).flatMap((item) => {
      const row = record(item);
      if (!row || !text(row.id)) return [];
      return [
        {
          id: text(row.id) ?? "",
          visitDate: text(row.visit_date) ?? "",
          serviceName: text(row.service_name) ?? "",
          createdAt: text(row.created_at) ?? "",
          createdByName: text(row.created_by_name),
        },
      ];
    }),
    claims: list(body.claims).flatMap((item) => {
      const row = record(item);
      if (!row || !text(row.id)) return [];
      return [
        {
          id: text(row.id) ?? "",
          milestone: numberValue(row.milestone) ?? 0,
          rewardName: text(row.reward_name) ?? "",
          serviceName: text(row.service_name),
          claimedAt: text(row.claimed_at) ?? "",
          cycleStart: text(row.cycle_start) ?? "",
          claimedByName: text(row.claimed_by_name),
        },
      ];
    }),
    birthdayRedemptions: list(body.birthday_redemptions).flatMap((item) => {
      const row = record(item);
      if (!row || !text(row.id)) return [];
      return [
        {
          id: text(row.id) ?? "",
          birthdayYear: numberValue(row.birthday_year) ?? 0,
          serviceName: text(row.service_name),
          redeemedAt: text(row.redeemed_at) ?? "",
          redeemedByName: text(row.redeemed_by_name),
        },
      ];
    }),
  };
}

import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";
import { normalizeMemberPhone } from "@/lib/membership/phone";
import { effectiveTier, rollCycle } from "@/lib/membership/rules";

export interface BuyerMemberLink {
  id: string;
  memberCode: string;
  effectiveTier: number;
}

export interface MemberMatchRecord {
  id: string;
  phone: string;
  memberCode: string;
  cycleStart: string;
  baseTier: number;
  stamps: Array<{
    cycleStart: string;
    visitAt: string;
    voided: boolean;
  }>;
}

function phoneKey(phone: string): string | null {
  return normalizeMemberPhone(phone) ?? normalizeBuyerPhone(phone) ?? null;
}

export function memberLinksByPhone(
  members: MemberMatchRecord[],
  today: string,
): Map<string, BuyerMemberLink> {
  const links = new Map<string, BuyerMemberLink>();
  for (const member of members) {
    const key = phoneKey(member.phone);
    if (!key) continue;
    const stampsByCycle: Record<string, number> = {};
    for (const stamp of member.stamps) {
      if (stamp.voided) continue;
      stampsByCycle[stamp.cycleStart] = (stampsByCycle[stamp.cycleStart] ?? 0) + 1;
    }
    const rolled = rollCycle({
      cycleStart: member.cycleStart,
      baseTier: member.baseTier,
      today,
      stampsByCycle,
    });
    links.set(key, {
      id: member.id,
      memberCode: member.memberCode,
      effectiveTier: effectiveTier(rolled.stampCount, rolled.baseTier),
    });
  }
  return links;
}

export function attachMemberLinks<T extends { phone: string }>(
  buyers: T[],
  members: MemberMatchRecord[],
  today: string,
): Array<T & { member: BuyerMemberLink | null }> {
  const links = memberLinksByPhone(members, today);
  return buyers.map((buyer) => {
    const key = phoneKey(buyer.phone) ?? buyer.phone;
    return { ...buyer, member: links.get(key) ?? null };
  });
}

export function memberAdminPath(memberIdOrCode: string): string {
  return `/admin/members?member=${encodeURIComponent(memberIdOrCode)}`;
}

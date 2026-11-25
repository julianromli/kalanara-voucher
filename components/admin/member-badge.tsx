import Link from "next/link";
import { memberAdminPath, type BuyerMemberLink } from "@/lib/admin/buyer-member-match";
import { tierName } from "@/lib/membership/rules";
import { TIER_PILL_STYLES } from "@/components/member/tier-pill";
import { cn } from "@/lib/utils";

export function MemberBadge({ member }: { member: BuyerMemberLink }) {
  const index = Math.max(0, Math.min(3, Math.trunc(member.effectiveTier)));
  const level = tierName(index);
  const label = index > 0 ? `Member · ${level}` : "Member";
  return (
    <Link
      href={memberAdminPath(member.id)}
      onClick={(event) => event.stopPropagation()}
      className="relative z-10 inline-flex min-h-11 min-w-11 items-center pointer-events-auto"
      aria-label={`Buka kartu member, ${level}`}
    >
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
          TIER_PILL_STYLES[index],
        )}
      >
        {label}
      </span>
    </Link>
  );
}

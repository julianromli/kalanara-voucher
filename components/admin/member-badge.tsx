import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { memberAdminPath, type BuyerMemberLink } from "@/lib/admin/buyer-member-match";
import { tierName } from "@/lib/membership/rules";

export function MemberBadge({ member }: { member: BuyerMemberLink }) {
  const level = tierName(member.effectiveTier);
  const label = member.effectiveTier > 0 ? `Member · ${level}` : "Member";
  return (
    <Link
      href={memberAdminPath(member.id)}
      onClick={(event) => event.stopPropagation()}
      className="relative z-10 inline-flex pointer-events-auto"
      aria-label={`Buka kartu member, ${level}`}
    >
      <Badge variant="outline">{label}</Badge>
    </Link>
  );
}

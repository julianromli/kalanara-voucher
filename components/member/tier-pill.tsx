import { tierName } from "@/lib/membership/rules";
import { cn } from "@/lib/utils";

// Tier is an identity, so it gets a tint with matching text and a ring in its
// own colour (Paper boards M1–M4, K3). Member stays neutral.
const TIER_STYLES = [
  "bg-background text-foreground ring-foreground/15",
  "bg-orange-100 text-orange-900 ring-current/15 dark:bg-orange-950 dark:text-orange-200",
  "bg-slate-100 text-slate-700 ring-current/15 dark:bg-slate-800 dark:text-slate-200",
  "bg-amber-100 text-amber-900 ring-current/15 dark:bg-amber-950 dark:text-amber-200",
] as const;

interface TierPillProps {
  tier: number;
  className?: string;
}

export function TierPill({ tier, className }: TierPillProps) {
  const index = Math.max(0, Math.min(3, Math.trunc(tier)));
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        TIER_STYLES[index],
        className,
      )}
    >
      {tierName(index)}
    </span>
  );
}

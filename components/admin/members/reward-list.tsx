import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cashierRewardLabel } from "@/lib/membership/copy";
import type { MemberSummary } from "@/lib/membership/summary";

interface RewardListProps {
  summary: MemberSummary;
  onClaim: (milestone: number) => void;
}

export function RewardList({ summary, onClaim }: RewardListProps) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Reward</h3>
      <ul>
        {summary.rewards.map((reward) => {
          const label = cashierRewardLabel(summary, reward);
          return (
            <li key={reward.milestone} className="flex h-11 items-center gap-3 text-sm">
              <span className="w-8 shrink-0 text-muted-foreground">{reward.milestone}×</span>
              <span className="min-w-0 flex-1 truncate">
                {(reward.claimId ? reward.claimedName : reward.name) || "Belum diatur"}
              </span>
              {label.canClaim ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onClaim(reward.milestone)}>
                  Klaim
                </Button>
              ) : label.text ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {reward.claimId ? <Check className="size-3 text-success" /> : null}
                  {label.text}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

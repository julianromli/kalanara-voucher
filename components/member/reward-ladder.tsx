import { memberRewardCopy } from "@/lib/membership/copy";
import type { MemberSummary } from "@/lib/membership/summary";

interface RewardLadderProps {
  summary: MemberSummary;
}

export function RewardLadder({ summary }: RewardLadderProps) {
  return (
    <section className="rounded-xl bg-background p-4 shadow-sm">
      <h2 className="text-sm font-medium">Reward dan level</h2>
      <ul className="mt-3 divide-y">
        {summary.rewards.map((reward) => {
          const copy = memberRewardCopy(summary, reward);
          return (
            <li key={reward.milestone} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{copy.title}</p>
                <p className="text-muted-foreground">{copy.detail}</p>
                {reward.note ? <p className="text-muted-foreground">{reward.note}</p> : null}
              </div>
              {copy.ready ? (
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
                  Siap dipakai
                </span>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">{copy.aside}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-sm text-muted-foreground">* Benefit level masih contoh, belum final.</p>
    </section>
  );
}

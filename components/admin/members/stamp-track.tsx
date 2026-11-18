import { Check } from "lucide-react";
import { MILESTONES } from "@/lib/membership/rules";
import { cn } from "@/lib/utils";

interface StampTrackProps {
  count: number;
  names: Array<string | null>;
}

export function StampTrack({ count, names }: StampTrackProps) {
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground"
          style={{ width: `${Math.min(count, 30) / 30 * 100}%` }}
        />
      </div>
      <ol className="mt-3 grid grid-cols-6 gap-1">
        {MILESTONES.map((milestone, index) => {
          const reached = count >= milestone;
          const tier =
            milestone === 10 ? "Bronze" : milestone === 20 ? "Silver" : milestone === 30 ? "Gold" : "";
          return (
            <li key={milestone} className="min-w-0 text-center">
              <span
                className={cn(
                  "mx-auto flex size-5 items-center justify-center rounded-full border text-[10px]",
                  reached
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {reached ? <Check className="size-3" /> : null}
              </span>
              <p className="mt-1 text-[11px] font-medium">
                {milestone}
                {tier ? ` · ${tier}` : ""}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {names[index] || "Belum diatur"}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

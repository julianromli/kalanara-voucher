"use client";

import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBuyerPhone } from "@/lib/admin/buyer-phone";
import { formatMemberDate, memberInitials } from "@/lib/membership/format";
import { tierBenefitLabel } from "@/lib/membership/rules";
import { TierPill } from "@/components/member/tier-pill";
import type { MemberSummary } from "@/lib/membership/summary";

interface MemberCardProps {
  summary: MemberSummary;
  canManageSettings: boolean;
  onSendLink: () => void;
  onCopyLink: () => void;
  onRotateLink: () => void;
}

export function MemberCard({
  summary,
  canManageSettings,
  onSendLink,
  onCopyLink,
  onRotateLink,
}: MemberCardProps) {
  const benefit = tierBenefitLabel(summary.effectiveTier);
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
        {memberInitials(summary.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{summary.name}</h2>
          <TierPill tier={summary.effectiveTier} />
          {summary.birthday.eligible ? (
            <Badge variant="outline">Diskon ultah 25% · s/d {formatMemberDate(summary.birthday.windowEnd)}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatBuyerPhone(summary.phone)} · Member sejak {formatMemberDate(summary.createdAt)} · Periode reset{" "}
          {formatMemberDate(summary.resetOn)}
          {benefit ? ` · ${benefit}` : ""}
        </p>
        {benefit ? (
          <p className="text-xs text-muted-foreground">* Benefit level masih contoh, belum final.</p>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" aria-label="Menu member">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onSendLink}>Kirim link kartu</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyLink}>Salin link</DropdownMenuItem>
          {canManageSettings ? (
            <DropdownMenuItem onSelect={onRotateLink}>Ganti link kartu</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

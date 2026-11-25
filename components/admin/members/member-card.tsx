"use client";

import type { ReactNode } from "react";
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
import type { MemberProfileAuditRow } from "@/lib/actions/members";
import { formatMemberDate, formatMemberTime, memberInitials } from "@/lib/membership/format";
import { tierBenefitLabel } from "@/lib/membership/rules";
import { whatsAppLink } from "@/lib/membership/templates";
import { TierPill } from "@/components/member/tier-pill";
import type { MemberSummary } from "@/lib/membership/summary";

const AUDIT_FIELD_LABEL: Record<MemberProfileAuditRow["field"], string> = {
  name: "Nama",
  phone: "Nomor HP",
  birth_date: "Tanggal lahir",
  wa_consent: "Izin WhatsApp",
};

function formatAuditValue(field: MemberProfileAuditRow["field"], value: string | null) {
  if (value == null || value === "") return "—";
  if (field === "phone") return formatBuyerPhone(value) || value;
  if (field === "birth_date") return formatMemberDate(value);
  if (field === "wa_consent") return value === "true" ? "Ya" : "Tidak";
  return value;
}

interface MemberCardProps {
  summary: MemberSummary;
  canManageSettings: boolean;
  onSendLink: () => void;
  onCopyLink: () => void;
  onRotateLink: () => void;
  onEdit?: () => void;
  auditRows?: MemberProfileAuditRow[];
  auditStatus?: "idle" | "loading" | "ok" | "error";
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground text-pretty">{children}</dd>
    </div>
  );
}

function MemberFacts({ summary }: { summary: MemberSummary }) {
  const phone = formatBuyerPhone(summary.phone) || summary.phone;
  const waHref =
    summary.waConsent ? whatsAppLink(summary.phone, `Halo ${summary.name.split(" ")[0] || summary.name}`) : null;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
      <Fact label="WhatsApp">
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buka WhatsApp ${phone}`}
            className="underline underline-offset-4"
          >
            {phone}
          </a>
        ) : (
          phone
        )}
      </Fact>
      <Fact label="Member sejak">{formatMemberDate(summary.createdAt)}</Fact>
      <Fact label="Periode reset">{formatMemberDate(summary.resetOn)}</Fact>
      {summary.lastTreatment ? (
        <Fact label="Terakhir">
          <span className="block">{formatMemberDate(summary.lastTreatment.date)}</span>
          {summary.lastTreatment.serviceName ? (
            <span className="block text-muted-foreground">{summary.lastTreatment.serviceName}</span>
          ) : null}
        </Fact>
      ) : (
        <Fact label="Terakhir">Belum ada kunjungan</Fact>
      )}
      <Fact label="Stamp periode ini">
        <span className="tabular-nums">{summary.stampCount} stamp</span>
      </Fact>
    </dl>
  );
}

export function MemberCard({
  summary,
  canManageSettings,
  onSendLink,
  onCopyLink,
  onRotateLink,
  onEdit,
  auditRows,
  auditStatus = "idle",
}: MemberCardProps) {
  const benefit = tierBenefitLabel(summary.effectiveTier);
  return (
    <div className="space-y-3">
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
          <MemberFacts summary={summary} />
          {benefit ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {benefit}
              <span className="mt-0.5 block text-xs">* Benefit level masih contoh, belum final.</span>
            </p>
          ) : null}
          {canManageSettings && onEdit ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onEdit}>
              Edit data
            </Button>
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
      {canManageSettings && auditStatus !== "idle" ? (
        <section>
          <h3 className="mb-1 text-sm font-medium">Riwayat perubahan</h3>
          {auditStatus === "loading" ? (
            <p className="text-sm text-muted-foreground">Memuat riwayat perubahan…</p>
          ) : auditStatus === "error" ? (
            <p className="text-sm text-muted-foreground">Riwayat perubahan gagal dimuat.</p>
          ) : (auditRows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada perubahan.</p>
          ) : (
            <ul>
              {(auditRows ?? []).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                  <div className="min-w-0">
                    <p className="break-words">
                      {AUDIT_FIELD_LABEL[row.field]}: {formatAuditValue(row.field, row.oldValue)} →{" "}
                      {formatAuditValue(row.field, row.newValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMemberDate(row.createdAt)}
                      {row.changedByEmail ? ` · ${row.changedByEmail}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatMemberTime(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

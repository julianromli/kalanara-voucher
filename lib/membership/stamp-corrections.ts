import { formatMemberDate } from "@/lib/membership/format";

export const STAMP_AUDIT_ACTIONS = ["void", "service", "visit_date", "add_past"] as const;
export type StampAuditAction = (typeof STAMP_AUDIT_ACTIONS)[number];

export const STAMP_REASON_MAX = 200;

export interface StampHistoryStamp {
  id: string;
  visitDate: string;
  serviceId: string | null;
  serviceName: string;
  createdAt: string;
  createdByName: string | null;
  voidedAt: string | null;
  voidedByName: string | null;
}

export interface StampAuditRow {
  id: string;
  stampId: string;
  action: StampAuditAction;
  oldValue: string | null;
  newValue: string | null;
  serviceName: string;
  visitDate: string;
  reason: string | null;
  claimsKept: Array<{ milestone: number; rewardName: string }>;
  changedByName: string | null;
  changedByEmail: string | null;
  changedByRole: string | null;
  createdAt: string;
}

export interface StampHistory {
  cycleStart: string;
  resetOn: string;
  today: string;
  stamps: StampHistoryStamp[];
  audit: StampAuditRow[];
}

export interface KeptClaim {
  milestone: number;
  rewardName: string;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isAuditAction(value: unknown): value is StampAuditAction {
  return typeof value === "string" && (STAMP_AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function parseKeptClaims(value: unknown): KeptClaim[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    const milestone = typeof row?.milestone === "number" ? row.milestone : null;
    if (!row || milestone == null) return [];
    return [{ milestone, rewardName: text(row.reward_name) ?? `Reward ${milestone}×` }];
  });
}

export function parseStampHistory(value: unknown): StampHistory | null {
  const body = record(value);
  if (!body || body.status !== "ok") return null;
  const cycleStart = text(body.cycle_start);
  const resetOn = text(body.reset_on);
  const today = text(body.today);
  if (!cycleStart || !resetOn || !today) return null;
  const stamps = Array.isArray(body.stamps) ? body.stamps : [];
  const audit = Array.isArray(body.audit) ? body.audit : [];
  return {
    cycleStart,
    resetOn,
    today,
    stamps: stamps.flatMap((item) => {
      const row = record(item);
      const id = text(row?.id);
      if (!row || !id) return [];
      return [
        {
          id,
          visitDate: text(row.visit_date) ?? "",
          serviceId: text(row.service_id),
          serviceName: text(row.service_name) ?? "",
          createdAt: text(row.created_at) ?? "",
          createdByName: text(row.created_by_name),
          voidedAt: text(row.voided_at),
          voidedByName: text(row.voided_by_name),
        },
      ];
    }),
    audit: audit.flatMap((item) => {
      const row = record(item);
      const id = text(row?.id);
      if (!row || !id || !isAuditAction(row.action)) return [];
      const details = record(row.details);
      return [
        {
          id,
          stampId: text(row.stamp_id) ?? "",
          action: row.action,
          oldValue: text(row.old_value),
          newValue: text(row.new_value),
          serviceName: text(row.service_name) ?? "",
          visitDate: text(row.visit_date) ?? "",
          reason: text(row.reason),
          claimsKept: parseKeptClaims(details?.claims_kept),
          changedByName: text(row.changed_by_name),
          changedByEmail: text(row.changed_by_email),
          changedByRole: text(row.changed_by_role),
          createdAt: text(row.created_at) ?? "",
        },
      ];
    }),
  };
}

/** Last day a stamp may be dated: today, or the day before reset if that is earlier. */
export function stampDateBounds(input: { cycleStart: string; resetOn: string; today: string }) {
  const dayBeforeReset = shiftISODate(input.resetOn, -1);
  return {
    min: input.cycleStart,
    max: input.today < dayBeforeReset ? input.today : dayBeforeReset,
  };
}

export function isStampDateAllowed(
  value: string,
  bounds: { min: string; max: string },
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= bounds.min && value <= bounds.max;
}

export function shiftISODate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Calendar date to a local Date at midnight, for the date picker. */
export function isoToLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToISO(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function claimWarning(claims: KeptClaim[], countAfter: number | null): string {
  const names = claims.map((claim) => `${claim.rewardName} (${claim.milestone} stamp)`).join(", ");
  const count = countAfter == null ? "" : ` Stamp jadi ${countAfter}.`;
  return `Reward ${names} udah diklaim di periode ini.${count} Klaimnya tetap tercatat dan nggak bisa diklaim dobel.`;
}

export function stampCorrectionMessage(
  status: string,
  context: { cycleStart?: string | null; resetOn?: string | null } = {},
): string {
  switch (status) {
    case "invalid":
      return "Datanya belum lengkap. Cek treatment, tanggal, dan alasan (maks. 200 huruf).";
    case "not_found":
      return "Stamp-nya udah nggak ada. Muat ulang kartu member.";
    case "already_voided":
      return "Stamp ini udah dihapus sebelumnya.";
    case "outside_period":
      return context.cycleStart && context.resetOn
        ? `Tanggalnya harus di periode ini: ${formatMemberDate(context.cycleStart)} sampai sebelum ${formatMemberDate(context.resetOn)}.`
        : "Stamp di periode lama nggak bisa diubah.";
    case "future_date":
      return "Tanggal kunjungan nggak boleh setelah hari ini.";
    case "invalid_date":
      return "Tanggal kunjungannya nggak valid.";
    case "invalid_service":
      return "Treatment itu udah nggak aktif. Pilih treatment lain.";
    case "capped":
      return "Stamp periode ini udah penuh (30).";
    case "unchanged":
      return "Nggak ada yang berubah.";
    case "network":
      return "Belum tersimpan. Koneksi putus, cek internet terus coba lagi.";
    default:
      return "Belum tersimpan. Server lagi bermasalah, coba lagi sebentar.";
  }
}

export function stampAuditSummary(row: StampAuditRow): string {
  switch (row.action) {
    case "void":
      return `Hapus stamp ${row.serviceName} · ${formatMemberDate(row.visitDate)}`;
    case "service":
      return `Treatment: ${row.oldValue ?? "—"} → ${row.newValue ?? "—"}`;
    case "visit_date":
      return `Tanggal ${row.serviceName}: ${row.oldValue ? formatMemberDate(row.oldValue) : "—"} → ${row.newValue ? formatMemberDate(row.newValue) : "—"}`;
    case "add_past":
      return `Tambah stamp lama ${row.serviceName} · ${formatMemberDate(row.visitDate)}`;
  }
}

const ROLE_LABEL: Record<string, string> = {
  STAFF: "Staff",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super Admin",
};

export function roleLabel(role: string | null): string | null {
  if (!role) return null;
  return ROLE_LABEL[role] ?? role;
}

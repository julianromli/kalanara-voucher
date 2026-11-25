"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { FollowUpTemplateSheet } from "@/components/admin/members/follow-up-template-sheet";
import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  buildFollowupMessage,
  listFollowups,
  markFollowupSent,
  undoFollowupSent,
} from "@/lib/actions/members";
import { formatBuyerPhone } from "@/lib/admin/buyer-phone";
import {
  formatMemberTime,
  memberInitials,
} from "@/lib/membership/format";
import { whatsAppLink } from "@/lib/membership/templates";
import type { FollowupTemplateStage } from "@/lib/membership/templates";

interface FollowUpRow {
  member_id: string;
  name: string;
  phone: string;
  stage: string;
  anchor_date: string;
  last_service_name: string;
  stamp_count: number;
  markedAt: string | null;
}

const filters = [
  { id: "all", label: "Semua" },
  { id: "day30", label: "Hari ke-30" },
  { id: "day60", label: "Hari ke-60" },
  { id: "day90", label: "Hari ke-90" },
  { id: "day120", label: "Hari ke-120" },
  { id: "birthday", label: "Ulang tahun" },
] as const;

const stageLabels: Record<string, string> = {
  day30: "Hari ke-30",
  day60: "Hari ke-60",
  day90: "Hari ke-90",
  day120: "Hari ke-120 · terakhir",
  birthday: "Ulang tahun",
};

interface FollowUpClientProps {
  initialRows: FollowUpRow[];
  loadError: boolean;
  templates: Array<{ stage: FollowupTemplateStage; text: string }>;
  canEditTemplates: boolean;
}

export function FollowUpClient({
  initialRows,
  loadError,
  templates,
  canEditTemplates,
}: FollowUpClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const previewRequest = useRef(0);
  const confirmKeyRef = useRef<string | null>(null);
  useEffect(() => {
    confirmKeyRef.current = confirmKey;
  }, [confirmKey]);
  const visible = useMemo(
    () => rows.filter((row) => filter === "all" || row.stage === filter),
    [filter, rows],
  );
  const waiting = rows.filter((row) => !row.markedAt).length;
  const sent = rows.length - waiting;

  async function send(row: FollowUpRow) {
    const key = rowKey(row);
    if (confirmKey !== key) {
      const requestId = previewRequest.current + 1;
      previewRequest.current = requestId;
      setSendError(null);
      let preview: Awaited<ReturnType<typeof buildFollowupMessage>>;
      try {
        preview = await buildFollowupMessage({
          memberId: row.member_id,
          stage: row.stage as FollowupTemplateStage,
        });
      } catch {
        if (requestId === previewRequest.current) setSendError("Pesan gagal dibuat. Coba lagi.");
        return;
      }
      if (requestId !== previewRequest.current) return;
      if (preview.status === "no_consent") {
        setSendError("Member ini belum setuju dihubungi lewat WhatsApp.");
        return;
      }
      if (preview.status !== "ok") {
        setSendError("Pesan gagal dibuat. Coba lagi.");
        return;
      }
      setWaUrl(preview.url);
      setConfirmKey(key);
      return;
    }
    setPendingId(key);
    try {
      const result = await markFollowupSent({
        memberId: row.member_id,
        stage: row.stage,
        anchorDate: row.anchor_date,
      });
      setPendingId(null);
      if (result.status === "ok" || result.status === "already_marked") {
        setSendError(null);
        if (confirmKeyRef.current === key) {
          setConfirmKey(null);
          setWaUrl(null);
        }
        const markedAt = result.markedAt || new Date().toISOString();
        setRows((current) =>
          current.map((item) =>
            rowKey(item) === key ? { ...item, markedAt } : item,
          ),
        );
        return;
      }
      if (result.status === "not_due") {
        setSendError("Follow up ini udah nggak perlu dikirim. Daftarnya di-refresh.");
        if (confirmKeyRef.current === key) {
          setConfirmKey(null);
          setWaUrl(null);
        }
        const listed = await listFollowups();
        if (listed.status === "ok") {
          setRows(listed.rows.map(toRow));
        }
        return;
      }
      setSendError("Tanda terkirim gagal disimpan. Pesan WhatsApp-nya jangan dikirim ulang.");
    } catch {
      setPendingId(null);
      setSendError("Tanda terkirim gagal disimpan. Pesan WhatsApp-nya jangan dikirim ulang.");
    }
  }

  function undoMark(row: FollowUpRow) {
    const key = rowKey(row);
    if (!row.markedAt) return;
    setPendingId(`undo:${key}`);
    setSendError(null);
    void undoFollowupSent({
      memberId: row.member_id,
      stage: row.stage,
      anchorDate: row.anchor_date,
      markedAt: row.markedAt,
    }).then(async (result) => {
      setPendingId(null);
      if (result.status !== "ok") {
        setSendError(
          result.status === "stale"
            ? "Tanda terkirim udah berubah. Muat ulang daftar ini."
            : "Tanda belum bisa dibatalin. Coba lagi.",
        );
        return;
      }
      const listed = await listFollowups();
      if (listed.status === "ok") {
        setRows(listed.rows.map(toRow));
        return;
      }
      setRows((current) =>
        current.map((item) => (rowKey(item) === key ? { ...item, markedAt: null } : item)),
      );
    }).catch(() => {
      setPendingId(null);
      setSendError("Tanda belum bisa dibatalin. Coba lagi.");
    });
  }

  // One action cell, shared by the phone list and the desktop table.
  function renderAction(row: FollowUpRow) {
    const key = rowKey(row);
    if (row.markedAt) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-success tabular-nums">
            <Check className="size-3" aria-hidden="true" />
            Terkirim {formatMemberTime(row.markedAt)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pendingId === `undo:${key}`}
            onClick={() => undoMark(row)}
          >
            Tandai belum
          </Button>
        </div>
      );
    }
    if (whatsAppLink(row.phone, "Halo") == null) {
      return <p className="text-destructive">Nomor nggak valid buat WhatsApp (kurang digit).</p>;
    }
    if (confirmKey === key) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Buka WhatsApp
            </a>
          ) : null}
          <p>Udah kirim?</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmKey(null)}>
            Belum
          </Button>
          <Button type="button" size="sm" disabled={pendingId === key} onClick={() => void send(row)}>
            {pendingId === key ? "Menandai…" : "Udah, tandai"}
          </Button>
        </div>
      );
    }
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => void send(row)}>
        Kirim WA
      </Button>
    );
  }

  return (
    <>
      <DashboardHeader title="Follow up hari ini" showActions={false} />
      <AdminPageBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {loadError
                ? "Daftar follow up gagal dimuat"
                : rows.length === 0
                  ? "Belum ada yang perlu di-follow up"
                  : `${waiting} customer perlu disapa hari ini${sent ? `, ${sent} udah terkirim` : ""}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Customer masuk daftar ini 30 hari setelah treatment walk-in terakhir, dan di hari ulang tahunnya."
                : "Klik Kirim WA. WhatsApp kebuka dengan pesan yang udah ditulis. Kamu tinggal tekan kirim."}
            </p>
          </div>
          {canEditTemplates && templates.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => setSheetOpen(true)}>
              Template pesan
            </Button>
          ) : canEditTemplates ? (
            <p className="text-sm text-destructive">Template gagal dimuat. Muat ulang sebelum mengedit.</p>
          ) : null}
        </div>
        {sendError ? <p className="text-sm text-destructive" role="alert">{sendError}</p> : null}
        {loadError ? (
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="size-4" />
            Coba lagi
          </Button>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border px-6 py-16 text-center">
            <MessageCircle className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium">Belum ada yang perlu di-follow up</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => {
                const count =
                  item.id === "all"
                    ? rows.length
                    : rows.filter((row) => row.stage === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`h-8 rounded-full px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                      filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label} <span className="tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
            <ul className="divide-y rounded-xl border md:hidden" aria-label="Daftar follow up hari ini">
              {visible.map((row) => (
                <li key={rowKey(row)} className="space-y-3 px-3 py-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                      {memberInitials(row.name || "?")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.name || "Member"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBuyerPhone(row.phone)} · {stageLabels[row.stage] ?? row.stage}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {row.stage === "birthday"
                          ? "Ulang tahun hari ini"
                          : `${row.last_service_name || "Treatment"} · ${row.stamp_count} stamp`}
                      </p>
                    </div>
                  </div>
                  <div className="pl-11">{renderAction(row)}</div>
                </li>
              ))}
            </ul>
            <div className="hidden rounded-xl border md:block">
              <table className="w-full text-sm" aria-label="Daftar follow up hari ini">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Alasan</th>
                    <th className="px-3 py-2 font-medium">Tahap</th>
                    <th className="px-3 py-2 font-medium">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={rowKey(row)} className="border-t">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                            {memberInitials(row.name || "?")}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{row.name || "Member"}</span>
                            <span className="text-xs text-muted-foreground">{formatBuyerPhone(row.phone)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p>{row.stage === "birthday" ? "Ulang tahun hari ini" : row.last_service_name || "Treatment"}</p>
                        {row.stage === "birthday" ? null : (
                          <p className="text-xs text-muted-foreground">{row.stamp_count} stamp</p>
                        )}
                      </td>
                      <td className="px-3 py-3">{stageLabels[row.stage] ?? row.stage}</td>
                      <td className="px-3 py-3">{renderAction(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Baris yang udah terkirim tetap kelihatan sampai besok. Salah tandai? Pakai Tandai belum.
            </p>
          </>
        )}
      </AdminPageBody>
      {canEditTemplates ? (
        <FollowUpTemplateSheet open={sheetOpen} onOpenChange={setSheetOpen} templates={templates} />
      ) : null}
    </>
  );
}

function toRow(item: FollowUpRow): FollowUpRow {
  return {
    member_id: item.member_id,
    name: item.name,
    phone: item.phone,
    stage: item.stage,
    anchor_date: item.anchor_date,
    last_service_name: item.last_service_name,
    stamp_count: item.stamp_count,
    markedAt: item.markedAt,
  };
}

function rowKey(row: FollowUpRow): string {
  return `${row.member_id}:${row.stage}:${row.anchor_date}`;
}

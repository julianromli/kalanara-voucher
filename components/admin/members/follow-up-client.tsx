"use client";

import { useMemo, useRef, useState } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { FollowUpTemplateSheet } from "@/components/admin/members/follow-up-template-sheet";
import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  buildFollowupMessage,
  markFollowupSent,
  undoFollowupSent,
} from "@/lib/actions/members";
import {
  formatMemberTime,
  maskMemberPhone,
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
        setConfirmKey(null);
        setWaUrl(null);
        setRows((current) =>
          current.map((item) =>
            rowKey(item) === key ? { ...item, markedAt: new Date().toISOString() } : item,
          ),
        );
        return;
      }
      setSendError("Tanda terkirim gagal disimpan. Pesan WhatsApp-nya jangan dikirim ulang.");
    } catch {
      setPendingId(null);
      setSendError("Tanda terkirim gagal disimpan. Pesan WhatsApp-nya jangan dikirim ulang.");
    }
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
        {sendError ? <p className="text-sm text-destructive">{sendError}</p> : null}
        {loadError ? (
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="size-4" />
            Coba lagi
          </Button>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border px-6 py-16 text-center">
            <MessageCircle className="size-6 text-muted-foreground" />
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
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      filter === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.label} {count}
                  </button>
                );
              })}
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Alasan</th>
                    <th className="px-3 py-2 font-medium">Tahap</th>
                    <th className="px-3 py-2 font-medium">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const phoneOk = whatsAppLink(row.phone, "Halo") != null;
                    const key = rowKey(row);
                    return (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">
                              {memberInitials(row.name || "?")}
                            </span>
                            <span>
                              <span className="block font-medium">{row.name || "Member"}</span>
                              <span className="text-xs text-muted-foreground">{maskMemberPhone(row.phone)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p>{row.stage === "birthday" ? "Ulang tahun hari ini" : row.last_service_name || "Treatment"}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.stage === "birthday" ? "" : `${row.stamp_count} stamp`}
                          </p>
                        </td>
                        <td className="px-3 py-3">{stageLabels[row.stage] ?? row.stage}</td>
                        <td className="px-3 py-3">
                          {row.markedAt ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-success">
                                <Check className="size-3" />
                                Terkirim {formatMemberTime(row.markedAt)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  void undoFollowupSent({
                                    memberId: row.member_id,
                                    stage: row.stage,
                                    anchorDate: row.anchor_date,
                                  }).then((result) => {
                                    if (result.status === "ok") {
                                      setRows((current) =>
                                        current.map((item) =>
                                          rowKey(item) === key ? { ...item, markedAt: null } : item,
                                        ),
                                      );
                                    }
                                  });
                                }}
                              >
                                Tandai belum
                              </Button>
                            </div>
                          ) : !phoneOk ? (
                            <p className="text-destructive">
                              Nomor nggak valid buat WhatsApp (kurang digit).
                            </p>
                          ) : confirmKey === key ? (
                            <div className="flex items-center gap-2">
                              {waUrl ? (
                                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                                  Buka WhatsApp
                                </a>
                              ) : null}
                              <p>Udah kirim?</p>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmKey(null)}>
                                Belum
                              </Button>
                              <Button type="button" size="sm" disabled={pendingId === key} onClick={() => void send(row)}>
                                Udah, tandai
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" size="sm" variant="outline" onClick={() => void send(row)}>
                              Kirim WA
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

function rowKey(row: FollowUpRow): string {
  return `${row.member_id}:${row.stage}:${row.anchor_date}`;
}

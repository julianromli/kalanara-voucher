"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserRound } from "lucide-react";
import { AddStampBar, cappedReason } from "@/components/admin/members/add-stamp-bar";
import { ClaimRewardDialog } from "@/components/admin/members/claim-reward-dialog";
import { MemberCard } from "@/components/admin/members/member-card";
import { MemberScanPanel } from "@/components/admin/members/member-scan-panel";
import { RegisterMemberDialog } from "@/components/admin/members/register-member-dialog";
import { RewardList } from "@/components/admin/members/reward-list";
import { StampTrack } from "@/components/admin/members/stamp-track";
import { VisitHistory } from "@/components/admin/members/visit-history";
import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  addStamp,
  findMember,
  getMember,
  getMemberWaLink,
  listRecentMembers,
  redeemBirthday,
  rotateCardToken,
  voidClaim,
  voidStamp,
} from "@/lib/actions/members";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { progressCopy, resetBanner } from "@/lib/membership/copy";
import {
  formatMemberDate,
  formatMemberTime,
  formatMemberWeekday,
  jakartaDateISO,
  memberInitials,
} from "@/lib/membership/format";
import { tierName } from "@/lib/membership/rules";
import type { MemberSummary } from "@/lib/membership/summary";
import { memberCardUrl } from "@/lib/membership/urls";

interface RecentMember {
  id: string;
  name: string;
  source: string;
  created_at: string;
  stamp_count: number;
  last_stamp_at: string | null;
  last_stamp_service: string | null;
  last_claim_at: string | null;
  last_claim_name: string | null;
}

interface MembersClientProps {
  initialRecent: RecentMember[];
  services: Array<{ id: string; name: string; duration: number }>;
  servicesError?: boolean;
}

export function MembersClient({ initialRecent, services, servicesError = false }: MembersClientProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [recent, setRecent] = useState(initialRecent);
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "found" | "rejected" | "not_found" | "loading">("idle");
  const [manual, setManual] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [confirm, setConfirm] = useState<{ serviceName: string; createdAt: string } | null>(null);
  const [stampError, setStampError] = useState(false);
  const [pending, setPending] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [claimMilestone, setClaimMilestone] = useState<number | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const canManage = hasPermission(AdminPermission.MEMBERS_SETTINGS);
  const progress = summary ? progressCopy(summary) : null;
  const resetNote = summary ? resetBanner(summary) : null;
  const today = useMemo(() => formatMemberWeekday(), []);

  async function openMember(next: MemberSummary) {
    setSummary(next);
    setScanStatus("found");
    setConfirm(null);
    setClaimMilestone(null);
    setRotateOpen(false);
    setStampError(false);
    setJustAdded(false);
    setBanner(resetBanner(next));
    const listed = await listRecentMembers();
    if (listed.status === "ok") setRecent(listed.members);
  }

  async function lookup(value: string) {
    setSummary(null);
    setConfirm(null);
    setClaimMilestone(null);
    setRotateOpen(false);
    setScanStatus("loading");
    const result = await findMember({ scan: value, origin: window.location.origin });
    if (result.status === "ok") {
      await openMember(result.summary);
      return;
    }
    if (result.status === "rejected") {
      setScanStatus("rejected");
      return;
    }
    if (result.status === "not_found") {
      setScanStatus("not_found");
      return;
    }
    if (result.status === "empty") {
      setScanStatus("idle");
      return;
    }
    setScanStatus("idle");
    showToast("Pencarian gagal. Coba lagi.", "error");
  }

  async function submitStamp(confirmSameDay = false) {
    if (!summary || !serviceId) return;
    const memberId = summary.id;
    setPending(true);
    setStampError(false);
    let result: Awaited<ReturnType<typeof addStamp>>;
    try {
      result = await addStamp({
        memberId,
        serviceId,
        confirmSameDay,
      });
    } catch {
      setPending(false);
      setStampError(true);
      return;
    }
    setPending(false);
    if (result.status === "needs_confirm") {
      setConfirm({
        serviceName: result.serviceName || "treatment",
        createdAt: result.createdAt || new Date().toISOString(),
      });
      return;
    }
    if (result.status === "capped") {
      const fresh = await getMember(memberId);
      if (fresh.status === "ok") {
        setSummary((current) => (current?.id === memberId ? fresh.summary : current));
        setBanner("Stamp periode ini sudah penuh. Siklus berikutnya mulai setelah reset.");
      }
      return;
    }
    if (result.status !== "ok" || !result.stampId) {
      setStampError(true);
      return;
    }
    const stampId = result.stampId;
    setConfirm(null);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 6000);
    if (result.openedReward && result.tierAfter != null && result.tierBefore != null && result.tierAfter > result.tierBefore) {
      setBanner(`${result.openedReward} kebuka, dan ${summary.name.split(" ")[0]} naik ke ${tierName(result.tierAfter)}. Klaim di daftar reward, sekarang atau di kunjungan berikutnya. Stamp nggak berkurang.`);
    } else if (result.openedReward) {
      setBanner(`${result.openedReward} kebuka. Klaim di daftar reward. Stamp nggak berkurang.`);
    }
    showToast(`Stamp ke-${result.count} tercatat`, "success", {
      duration: 6000,
      actionLabel: "Batalkan",
      onAction: () => {
        setJustAdded(false);
        void voidStamp({ stampId }).then(async (voided) => {
          if (voided.status !== "ok") {
            showToast(
              voided.status === "reward_claimed"
                ? "Stamp nggak bisa dibatalin. Reward-nya udah diklaim."
                : "Stamp nggak bisa dibatalin. Lewat 5 menit.",
              "error",
            );
            return;
          }
          const fresh = await getMember(memberId);
          if (fresh.status === "ok") {
            setSummary((current) => (current?.id === memberId ? fresh.summary : current));
          }
          const listed = await listRecentMembers();
          if (listed.status === "ok") setRecent(listed.members);
        }).catch(() => {
          showToast("Stamp nggak bisa dibatalin. Koneksi putus.", "error");
        });
      },
    });
    const fresh = await getMember(memberId);
    if (fresh.status === "ok") {
      setSummary((current) => (current?.id === memberId ? fresh.summary : current));
    }
    const listed = await listRecentMembers();
    if (listed.status === "ok") setRecent(listed.members);
  }

  const claimRewardRow = summary?.rewards.find((reward) => reward.milestone === claimMilestone);

  return (
    <>
      <DashboardHeader title={`Member · ${today}`} showActions={false} />
      <AdminPageBody>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" />
            Daftar member baru
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <MemberScanPanel
              onScan={(value) => void lookup(value)}
              status={scanStatus}
              statusName={summary?.name.split(" ")[0]}
              manualValue={manual}
              onManualChange={setManual}
              onManualSubmit={() => void lookup(manual)}
            />
            {scanStatus === "not_found" ? (
              <Button type="button" className="mt-3" onClick={() => setRegisterOpen(true)}>
                Daftarkan {manual || "nomor ini"}
              </Button>
            ) : null}
            <section className="mt-6">
              <h2 className="px-2 text-sm font-medium">Barusan dilayani</h2>
              <ul className="-mx-2 mt-1">
                {recent.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-muted-foreground">Belum ada member.</li>
                ) : (
                  recent.map((member, index) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void getMember(member.id).then((result) => {
                            if (result.status === "ok") void openMember(result.summary);
                          });
                        }}
                        className={`flex h-13 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-muted/40 ${index === 0 ? "bg-muted/40" : ""}`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {memberInitials(member.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{member.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {recentActivity(member).subtitle}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMemberTime(recentActivity(member).at)}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div>
            {summary && progress ? (
              <div className="space-y-5">
                <MemberCard
                  summary={summary}
                  canManageSettings={canManage}
                  onSendLink={() => {
                    const popup = window.open("", "_blank", "noopener,noreferrer");
                    void getMemberWaLink({ memberId: summary.id, kind: "card" }).then((result) => {
                      if (result.status === "ok" && popup) {
                        popup.location.href = result.url;
                        return;
                      }
                      popup?.close();
                      showToast("Link WhatsApp gagal dibuka", "error");
                    });
                  }}
                  onCopyLink={() => {
                    void navigator.clipboard
                      .writeText(memberCardUrl(summary.cardToken))
                      .then(() => showToast("Link tersalin", "success", { duration: 1500 }))
                      .catch(() => showToast("Link gagal disalin", "error"));
                  }}
                  onRotateLink={() => setRotateOpen(true)}
                  onOpenSettings={() => router.push("/admin/members/settings")}
                />
                {summary.birthday.eligible ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
                    <p>
                      {summary.name.split(" ")[0]} lagi di minggu ulang tahun. Diskon 25% buat 1 treatment, berlaku {formatMemberDate(summary.birthday.windowStart)}–{formatMemberDate(summary.birthday.windowEnd)}. Sekali setahun.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const serviceName = services.find((service) => service.id === serviceId)?.name;
                        if (!serviceName) return;
                        void redeemBirthday({ memberId: summary.id, serviceName }).then(async (result) => {
                          if (result.status !== "ok") {
                            showToast("Diskon ultah belum tercatat.", "error");
                            return;
                          }
                          showToast("Diskon ultah dipakai", "success");
                          const fresh = await getMember(summary.id);
                          if (fresh.status === "ok") setSummary(fresh.summary);
                        });
                      }}
                    >
                      Pakai diskon
                    </Button>
                  </div>
                ) : null}
                {servicesError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                    <p className="font-medium">Daftar treatment gagal dimuat.</p>
                    <p className="mt-1 text-muted-foreground">Stamp dan klaim belum bisa dilanjut sampai daftarnya ke-load.</p>
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
                      Coba lagi
                    </Button>
                  </div>
                ) : services.length === 0 ? (
                  <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
                    Belum ada treatment aktif. Stamp dan klaim belum bisa dilanjut.
                  </p>
                ) : null}
                {banner ? (
                  <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
                    <p className="font-medium">{banner}</p>
                  </div>
                ) : null}
                {resetNote && !banner ? (
                  <div className="rounded-xl bg-muted px-4 py-3 text-sm">{resetNote}</div>
                ) : null}
                <div>
                  <p className="text-4xl font-semibold tracking-tight">
                    {summary.stampCount} <span className="text-base font-medium text-muted-foreground">stamp</span>
                  </p>
                  <p className="mt-1 text-sm font-medium">{progress.title}</p>
                  {progress.detail ? <p className="text-sm text-muted-foreground">{progress.detail}</p> : null}
                  <StampTrack
                    count={summary.stampCount}
                    names={summary.rewards.map((reward) => reward.name)}
                  />
                </div>
                <AddStampBar
                  services={services}
                  serviceId={serviceId}
                  onServiceChange={setServiceId}
                  disabledReason={summary.stampCount >= 30 ? cappedReason(summary.resetOn) : null}
                  justAdded={justAdded}
                  confirm={confirm ? { ...confirm, memberName: summary.name } : null}
                  error={stampError}
                  pending={pending}
                  hasStampToday={summary.stamps.some((stamp) => stamp.visitDate === jakartaDateISO()) || justAdded}
                  onAdd={() => void submitStamp(false)}
                  onConfirm={() => void submitStamp(true)}
                  onCancelConfirm={() => setConfirm(null)}
                  onRetry={() => void submitStamp(Boolean(confirm))}
                />
                <div className="grid gap-6 md:grid-cols-2">
                  <RewardList summary={summary} onClaim={setClaimMilestone} />
                  <VisitHistory summary={summary} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center text-center">
                <UserRound className="size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Scan QR member buat mulai</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Kartu member, stamp, dan reward muncul di sini. Customer belum punya QR? Pakai Daftar member baru di kanan atas.
                </p>
              </div>
            )}
          </div>
        </div>
      </AdminPageBody>

      <RegisterMemberDialog
        key={`${registerOpen ? "open" : "closed"}-${manual}`}
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        initialPhone={scanStatus === "not_found" ? manual : ""}
        onCreated={(created) => void openMember(created)}
        onOpenExisting={(memberId) => {
          setRegisterOpen(false);
          void getMember(memberId).then((result) => {
            if (result.status === "ok") void openMember(result.summary);
          });
        }}
      />
      {summary && claimRewardRow?.name ? (
        <ClaimRewardDialog
          open={claimMilestone != null}
          memberId={summary.id}
          memberName={summary.name}
          milestone={claimRewardRow.milestone}
          rewardName={claimRewardRow.name}
          stampCount={summary.stampCount}
          services={services}
          servicesError={servicesError}
          onOpenChange={(open) => {
            if (!open) setClaimMilestone(null);
          }}
          onClaimed={(claimId, rewardName) => {
            const memberId = summary.id;
            showToast(`${rewardName} diklaim`, "success", {
              duration: 6000,
              actionLabel: "Batalkan",
              onAction: () => {
                void voidClaim({ claimId }).then(async (result) => {
                  if (result.status !== "ok") {
                    showToast("Klaim nggak bisa dibatalin.", "error");
                    return;
                  }
                  const fresh = await getMember(memberId);
                  if (fresh.status === "ok") {
                    setSummary((current) => (current?.id === memberId ? fresh.summary : current));
                  }
                  const listed = await listRecentMembers();
                  if (listed.status === "ok") setRecent(listed.members);
                }).catch(() => {
                  showToast("Klaim nggak bisa dibatalin. Koneksi putus.", "error");
                });
              },
            });
            void getMember(memberId).then(async (fresh) => {
              if (fresh.status === "ok") {
                setSummary((current) => (current?.id === memberId ? fresh.summary : current));
              }
              const listed = await listRecentMembers();
              if (listed.status === "ok") setRecent(listed.members);
            });
          }}
        />
      ) : null}
      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti link kartu?</AlertDialogTitle>
            <AlertDialogDescription>
              Link lama langsung mati. Customer perlu link yang baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (!summary) return;
                const memberId = summary.id;
                void rotateCardToken({ memberId }).then(async (result) => {
                  setRotateOpen(false);
                  if (result.status === "ok") {
                    setSummary((current) => (current?.id === memberId ? result.summary : current));
                    showToast("Link kartu diganti", "success");
                    return;
                  }
                  if (result.status === "rotated") {
                    const fresh = await getMember(memberId);
                    if (fresh.status === "ok") {
                      setSummary((current) => (current?.id === memberId ? fresh.summary : current));
                    }
                    showToast("Link kartu diganti. Muat ulang kartu kalau salin link masih yang lama.", "success");
                    return;
                  }
                  showToast("Link belum diganti. Koneksi putus.", "error");
                });
              }}
            >
              Ya, ganti link
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function recentActivity(member: RecentMember): { at: string; subtitle: string } {
  const claimIsNewer = Boolean(
    member.last_claim_at &&
      (!member.last_stamp_at || member.last_claim_at > member.last_stamp_at),
  );
  if (claimIsNewer && member.last_claim_at && member.last_claim_name) {
    return {
      at: member.last_claim_at,
      subtitle: `Klaim ${member.last_claim_name.toLowerCase()}`,
    };
  }
  if (member.last_stamp_at) {
    return {
      at: member.last_stamp_at,
      subtitle: member.stamp_count > 0 ? `Stamp ke-${member.stamp_count}` : "Stamp tercatat",
    };
  }
  if (member.source === "self_signup") {
    return { at: member.created_at, subtitle: "Member baru · daftar sendiri" };
  }
  return { at: member.created_at, subtitle: "Member baru" };
}

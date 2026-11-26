"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal, Plus } from "lucide-react";
import {
  AddStampBar,
  cappedReason,
  stampFailureMessage,
  stampThrownMessage,
} from "@/components/admin/members/add-stamp-bar";
import { ClaimRewardDialog } from "@/components/admin/members/claim-reward-dialog";
import { EditMemberDialog } from "@/components/admin/members/edit-member-dialog";
import { MemberCard } from "@/components/admin/members/member-card";
import { MemberDirectory } from "@/components/admin/members/member-directory";
import { MemberPurchaseHistory } from "@/components/admin/members/member-purchase-history";
import {
  MemberScanPanel,
  type MemberNameHit,
} from "@/components/admin/members/member-scan-panel";
import { RegisterMemberDialog } from "@/components/admin/members/register-member-dialog";
import { RewardList } from "@/components/admin/members/reward-list";
import { StampTrack } from "@/components/admin/members/stamp-track";
import { VisitHistory } from "@/components/admin/members/visit-history";
import { AdminPageBody } from "@/components/admin/admin-page";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  listMemberProfileAudit,
  listMembers,
  listRecentMembers,
  searchMembers,
  redeemBirthday,
  rotateCardToken,
  voidClaim,
  voidStamp,
} from "@/lib/actions/members";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { progressCopy, resetBanner, stampBanner } from "@/lib/membership/copy";
import {
  formatMemberDate,
  formatMemberTime,
  formatMemberWeekday,
  jakartaDateISO,
  memberInitials,
} from "@/lib/membership/format";
import { createLatestRequestGate } from "@/lib/membership/latest-request";
import type { MemberSummary } from "@/lib/membership/summary";
import { buildAdminPage } from "@/lib/actions/admin-pagination";
import type { ListMembersResult, MemberProfileAuditRow } from "@/lib/actions/members";
import type { MemberListRow } from "@/lib/membership/list";
import { isMemberNameQuery, parseMemberScan } from "@/lib/membership/scan";
import { memberCardUrl, tryAppBaseUrl } from "@/lib/membership/urls";

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

const EMPTY_FOLLOW_UP = { nearReward: [] as MemberListRow[], frequent: [] as MemberListRow[] };
const EMPTY_LIST_PAGE = buildAdminPage<MemberListRow>([], 1, 0);

interface MembersClientProps {
  initialRecent: RecentMember[];
  initialList?: ListMembersResult | null;
  initialMember?: string;
  services: Array<{ id: string; name: string; duration: number }>;
  servicesError?: boolean;
}

export function MembersClient({
  initialRecent,
  initialList = null,
  initialMember,
  services,
  servicesError = false,
}: MembersClientProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const [recent, setRecent] = useState(initialRecent);
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "found" | "rejected" | "not_found" | "loading">("idle");
  const [manual, setManual] = useState("");
  const [nameResults, setNameResults] = useState<MemberNameHit[]>([]);
  const [nameStatus, setNameStatus] = useState<"idle" | "searching" | "empty">("idle");
  const searchRequest = useRef(0);
  const nameSearchTimer = useRef<number | null>(null);
  const skipNameSearchDebounce = useRef(false);
  const [listPage, setListPage] = useState(initialList?.page ?? EMPTY_LIST_PAGE);
  const [listFollowUp, setListFollowUp] = useState(initialList?.followUp ?? EMPTY_FOLLOW_UP);
  const [listQuery, setListQuery] = useState("");
  const [listTier, setListTier] = useState("all");
  const [listPageNumber, setListPageNumber] = useState(initialList?.page.page ?? 1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(initialList == null);
  const listRequest = useRef(0);
  const skipFirstListFetch = useRef(initialList != null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [confirm, setConfirm] = useState<{ serviceName: string; createdAt: string } | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const justAddedTimer = useRef<number | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [claimMilestone, setClaimMilestone] = useState<number | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotatePending, setRotatePending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<MemberProfileAuditRow[]>([]);
  const [auditStatus, setAuditStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const auditRequest = useRef(0);
  const [banner, setBanner] = useState<string | null>(null);
  const recentRequest = useRef(0);
  // Every action that changes the open member takes a ticket. Only the newest
  // ticket may write the reloaded summary, so a slow reload from an older
  // action (for example the add before an undo) can't overwrite a newer one.
  const [summaryGate] = useState(createLatestRequestGate);
  const selectedIdRef = useRef<string | null>(null);
  const canManage = hasPermission(AdminPermission.MEMBERS_SETTINGS);
  const progress = summary ? progressCopy(summary) : null;
  const resetNote = summary ? resetBanner(summary) : null;
  const today = useMemo(() => formatMemberWeekday(), []);

  useEffect(() => {
    selectedIdRef.current = summary?.id ?? null;
  }, [summary?.id]);

  const loadAudit = useCallback((memberId: string) => {
    if (!canManage) {
      setAuditRows([]);
      setAuditStatus("idle");
      return;
    }
    const requestId = auditRequest.current + 1;
    auditRequest.current = requestId;
    setAuditRows([]);
    setAuditStatus("loading");
    void listMemberProfileAudit(memberId)
      .then((result) => {
        if (requestId !== auditRequest.current || selectedIdRef.current !== memberId) return;
        if (result.status === "ok") {
          setAuditRows(result.rows);
          setAuditStatus("ok");
          return;
        }
        setAuditRows([]);
        setAuditStatus("error");
      })
      .catch(() => {
        if (requestId !== auditRequest.current || selectedIdRef.current !== memberId) return;
        setAuditRows([]);
        setAuditStatus("error");
      });
  }, [canManage]);

  useEffect(() => {
    if (!summary?.id || !canManage) {
      setAuditRows([]);
      setAuditStatus("idle");
      return;
    }
    loadAudit(summary.id);
  }, [summary?.id, canManage, loadAudit]);

  const openedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    const raw = initialMember?.trim() ?? "";
    if (!raw) {
      openedDeepLink.current = null;
      return;
    }
    if (openedDeepLink.current === raw) return;
    openedDeepLink.current = raw;
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw,
      );
    if (uuid) {
      void selectMember(raw);
      return;
    }
    const ticket = summaryGate.begin();
    void findMember({ scan: raw })
      .then((result) => {
        if (!summaryGate.isLatest(ticket)) return;
        if (result.status === "ok") {
          void openMember(result.summary);
          return;
        }
        showToast("Kartu member gagal dibuka. Coba lagi.", "error");
      })
      .catch(() => {
        if (!summaryGate.isLatest(ticket)) return;
        showToast("Kartu member gagal dibuka. Coba lagi.", "error");
      });
    // Landing query should open once. Fresh function identities must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMember]);

  useEffect(
    () => () => {
      if (justAddedTimer.current != null) window.clearTimeout(justAddedTimer.current);
    },
    [],
  );

  function beginSearchRequest() {
    searchRequest.current += 1;
    return searchRequest.current;
  }

  function clearNameSearchTimer() {
    if (nameSearchTimer.current != null) {
      window.clearTimeout(nameSearchTimer.current);
      nameSearchTimer.current = null;
    }
  }

  function changeManual(value: string) {
    clearNameSearchTimer();
    // Invalidate in-flight results for the previous query on this keystroke,
    // before a submit of the new query starts, so the effect below never
    // races with that submit and marks it stale.
    beginSearchRequest();
    setManual(value);
  }

  useEffect(() => {
    const query = manual.trim();
    if (skipNameSearchDebounce.current) {
      skipNameSearchDebounce.current = false;
      if (!isMemberNameQuery(query)) {
        setNameResults([]);
        setNameStatus("idle");
      }
      return;
    }
    clearNameSearchTimer();
    if (!isMemberNameQuery(query)) {
      setNameResults([]);
      setNameStatus("idle");
      return;
    }
    nameSearchTimer.current = window.setTimeout(() => {
      nameSearchTimer.current = null;
      void runNameSearch(query, false);
    }, 250);
    return () => clearNameSearchTimer();
    // runNameSearch reads current toasts/gates; the query string is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual]);

  async function loadMemberList(params: { query: string; tier: string; page: number }) {
    const requestId = listRequest.current + 1;
    listRequest.current = requestId;
    setListLoading(true);
    try {
      const result = await listMembers(params);
      if (requestId !== listRequest.current) return;
      setListLoading(false);
      if (result.status !== "ok") {
        setListError(true);
        return;
      }
      setListError(false);
      setListPage(result.page);
      setListFollowUp(result.followUp);
    } catch {
      if (requestId !== listRequest.current) return;
      setListLoading(false);
      setListError(true);
    }
  }

  useEffect(() => {
    if (skipFirstListFetch.current) {
      skipFirstListFetch.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      void loadMemberList({ query: listQuery, tier: listTier, page: listPageNumber });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [listQuery, listTier, listPageNumber]);

  function backToList() {
    summaryGate.begin();
    setSummary(null);
    setScanStatus("idle");
    setConfirm(null);
    setClaimMilestone(null);
    setBanner(null);
    void loadMemberList({ query: listQuery, tier: listTier, page: listPageNumber });
  }

  async function refreshRecent() {
    const requestId = recentRequest.current + 1;
    recentRequest.current = requestId;
    const listed = await listRecentMembers();
    if (requestId !== recentRequest.current) return;
    if (listed.status === "ok") setRecent(listed.members);
  }

  async function reloadSummary(memberId: string, ticket: number) {
    const fresh = await getMember(memberId);
    if (!summaryGate.isLatest(ticket) || fresh.status !== "ok") return;
    setSummary((current) => (current?.id === memberId ? fresh.summary : current));
  }

  async function openMember(next: MemberSummary) {
    summaryGate.begin();
    setSummary(next);
    setScanStatus("found");
    setConfirm(null);
    setClaimMilestone(null);
    setRotateOpen(false);
    setStampError(null);
    setJustAdded(false);
    setNameResults([]);
    setNameStatus("idle");
    setBanner(resetBanner(next));
    await refreshRecent();
  }

  async function runNameSearch(query: string, openIfSingle: boolean) {
    const requestId = beginSearchRequest();
    setNameStatus("searching");
    setNameResults([]);
    let settled = false;
    try {
      const result = await searchMembers({ q: query });
      if (requestId !== searchRequest.current) return;
      if (result.status !== "ok") {
        showToast("Pencarian gagal. Coba lagi.", "error");
        return;
      }
      if (result.members.length === 0) {
        setNameStatus("empty");
        setNameResults([]);
        setScanStatus("idle");
        settled = true;
        return;
      }
      if (openIfSingle && result.members.length === 1) {
        setNameStatus("idle");
        setNameResults([]);
        settled = true;
        await selectMember(result.members[0].id);
        return;
      }
      setNameStatus("idle");
      setNameResults(result.members);
      setScanStatus("idle");
      settled = true;
    } catch {
      if (requestId !== searchRequest.current) return;
      showToast("Pencarian gagal. Coba lagi.", "error");
    } finally {
      if (!settled && requestId === searchRequest.current) {
        setNameStatus("idle");
        setScanStatus("idle");
      }
    }
  }

  async function selectMember(memberId: string) {
    // A new selection invalidates an in-flight name search, but not the
    // getMember ticket this function is about to take.
    beginSearchRequest();
    const ticket = summaryGate.begin();
    setScanStatus("loading");
    setNameResults([]);
    setNameStatus("idle");
    let opened = false;
    try {
      const result = await getMember(memberId);
      if (!summaryGate.isLatest(ticket)) return;
      if (result.status === "ok") {
        await openMember(result.summary);
        opened = true;
        return;
      }
      showToast("Kartu member gagal dibuka. Coba lagi.", "error");
    } catch {
      if (!summaryGate.isLatest(ticket)) return;
      showToast("Kartu member gagal dibuka. Coba lagi.", "error");
    } finally {
      if (!opened && summaryGate.isLatest(ticket)) {
        setScanStatus((current) => (current === "loading" ? "idle" : current));
      }
    }
  }

  async function lookup(value: string) {
    clearNameSearchTimer();
    skipNameSearchDebounce.current = true;
    const requestId = beginSearchRequest();
    summaryGate.begin();
    setSummary(null);
    setConfirm(null);
    setClaimMilestone(null);
    setRotateOpen(false);
    setNameResults([]);
    setNameStatus("idle");
    const parsed = parseMemberScan(value, {
      appUrl: tryAppBaseUrl() || undefined,
      origin: window.location.origin,
    });
    if (parsed.kind === "empty") {
      setScanStatus("idle");
      return;
    }
    const exactLookup =
      parsed.kind === "token" || parsed.kind === "phone" || parsed.kind === "code";
    if (!exactLookup) {
      if (isMemberNameQuery(value)) {
        setScanStatus("loading");
        await runNameSearch(value, true);
        return;
      }
      setScanStatus("rejected");
      return;
    }
    setScanStatus("loading");
    try {
      const result = await findMember({ scan: value, origin: window.location.origin });
      if (requestId !== searchRequest.current) return;
      if (result.status === "ok") {
        await openMember(result.summary);
        return;
      }
      if (result.status === "rejected") {
        setScanStatus("rejected");
        return;
      }
      if (result.status === "not_found") {
        if (isMemberNameQuery(value)) {
          await runNameSearch(value, true);
          return;
        }
        setScanStatus("not_found");
        return;
      }
      if (result.status === "empty") {
        setScanStatus("idle");
        return;
      }
      setScanStatus("idle");
      showToast("Pencarian gagal. Coba lagi.", "error");
    } catch {
      if (requestId !== searchRequest.current) return;
      setScanStatus("idle");
      showToast("Pencarian gagal. Coba lagi.", "error");
    }
  }

  async function submitStamp(confirmSameDay = false) {
    if (!summary || !serviceId) return;
    const memberId = summary.id;
    const memberName = summary.name;
    const ticket = summaryGate.begin();
    setPending(true);
    setStampError(null);
    let result: Awaited<ReturnType<typeof addStamp>>;
    try {
      result = await addStamp({
        memberId,
        serviceId,
        confirmSameDay,
      });
    } catch (error) {
      setPending(false);
      setStampError(stampThrownMessage(error));
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
      if (selectedIdRef.current === memberId) {
        setBanner("Stamp periode ini udah penuh. Mulai lagi dari 0 setelah reset.");
      }
      await reloadSummary(memberId, ticket);
      return;
    }
    if (result.status !== "ok" || !result.stampId) {
      setStampError(stampFailureMessage(result.status));
      return;
    }
    const stampId = result.stampId;
    const addedCount = result.count;
    if (addedCount != null && summaryGate.isLatest(ticket)) {
      // Show the new count right away; the reload below fills in the rest.
      setSummary((current) => (current?.id === memberId ? { ...current, stampCount: addedCount } : current));
    }
    setConfirm(null);
    setJustAdded(true);
    // Restart the 6s window on every stamp, so an older timer can't clear it early.
    if (justAddedTimer.current != null) window.clearTimeout(justAddedTimer.current);
    justAddedTimer.current = window.setTimeout(() => {
      justAddedTimer.current = null;
      setJustAdded(false);
    }, 6000);
    // The banner shows only what this stamp changed; a plain stamp clears it.
    setBanner(stampBanner(result, memberName));
    showToast(`Stamp ke-${result.count} tercatat`, "success", {
      duration: 6000,
      actionLabel: "Batalkan",
      onAction: () => {
        const undoTicket = summaryGate.begin();
        setJustAdded(false);
        setBanner(null);
        void voidStamp({ stampId }).then(async (voided) => {
          if (voided.status !== "ok") {
            showToast(
              voided.status === "reward_claimed"
                ? "Stamp nggak bisa dibatalin. Reward-nya udah diklaim."
                : "Stamp nggak bisa dibatalin. Lewat 5 menit.",
              "error",
            );
          }
          await reloadSummary(memberId, undoTicket);
          await refreshRecent();
        }).catch(() => {
          showToast("Stamp nggak bisa dibatalin. Koneksi putus.", "error");
          void reloadSummary(memberId, undoTicket);
        });
      },
    });
    await reloadSummary(memberId, ticket);
    await refreshRecent();
  }

  const claimRewardRow = summary?.rewards.find((reward) => reward.milestone === claimMilestone);

  return (
    <>
      <DashboardHeader
        title={`Member · ${today}`}
        showActions={false}
        endSlot={
          canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Pengaturan member">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push("/admin/members/settings")}>
                  Pengaturan member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
      <AdminPageBody>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" />
            Daftar member baru
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0">
            <MemberScanPanel
              onScan={(value) => void lookup(value)}
              status={scanStatus}
              statusName={summary?.name.split(" ")[0]}
              manualValue={manual}
              onManualChange={changeManual}
              onManualSubmit={() => void lookup(manual)}
              nameResults={nameResults}
              nameStatus={nameStatus}
              onPickNameResult={selectMember}
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
                  recent.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        aria-current={summary?.id === member.id ? "true" : undefined}
                        onClick={() => selectMember(member.id)}
                        className={`flex h-13 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 ${summary?.id === member.id ? "bg-muted/40" : ""}`}
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
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatMemberTime(recentActivity(member).at)}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="min-w-0">
            {summary && progress ? (
              <div className="space-y-5">
                <div>
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2" onClick={backToList}>
                    <ChevronLeft className="size-4" />
                    Kembali ke daftar
                  </Button>
                  <MemberCard
                  summary={summary}
                  canManageSettings={canManage}
                  onEdit={() => setEditOpen(true)}
                  auditRows={auditRows}
                  auditStatus={auditStatus}
                  onSendLink={() => {
                    // Open the tab inside the click so the popup blocker allows it.
                    // "noopener" would make window.open return null, so cut the
                    // opener by hand once the tab exists.
                    const popup = window.open("", "_blank");
                    if (popup) popup.opener = null;
                    void getMemberWaLink({ memberId: summary.id, kind: "card" }).then((result) => {
                      if (result.status === "ok" && popup) {
                        popup.location.href = result.url;
                        return;
                      }
                      popup?.close();
                      showToast("Link WhatsApp gagal dibuka", "error");
                    }).catch(() => {
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
                />
                </div>
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
                        const memberId = summary.id;
                        const ticket = summaryGate.begin();
                        void redeemBirthday({ memberId, serviceName }).then(async (result) => {
                          if (result.status !== "ok") {
                            showToast("Diskon ultah belum tercatat.", "error");
                            return;
                          }
                          showToast("Diskon ultah dipakai", "success");
                          await reloadSummary(memberId, ticket);
                        }).catch(() => {
                          showToast("Diskon ultah belum tercatat. Koneksi putus.", "error");
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
                  <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm" role="status">
                    <p className="font-medium">{banner}</p>
                  </div>
                ) : null}
                {resetNote && !banner ? (
                  <div className="rounded-xl bg-muted px-4 py-3 text-sm">{resetNote}</div>
                ) : null}
                <div>
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">
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
                <MemberPurchaseHistory key={summary.id} phone={summary.phone} />
              </div>
            ) : (
              <MemberDirectory
                page={listPage}
                followUp={listFollowUp}
                query={listQuery}
                onQueryChange={(value) => {
                  setListQuery(value);
                  setListPageNumber(1);
                }}
                tier={listTier}
                onTierChange={(value) => {
                  setListTier(value);
                  setListPageNumber(1);
                }}
                onPageChange={setListPageNumber}
                onSelect={selectMember}
                loading={listLoading}
                error={listError}
                onRetry={() => {
                  void loadMemberList({ query: listQuery, tier: listTier, page: listPageNumber }).catch(() => {
                    setListLoading(false);
                    setListError(true);
                  });
                }}
              />
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
          selectMember(memberId);
        }}
      />
      <EditMemberDialog
        open={editOpen}
        summary={summary}
        onOpenChange={setEditOpen}
        onSaved={(next, memberId) => {
          showToast("Data member tersimpan.", "success");
          if (selectedIdRef.current !== memberId) return;
          summaryGate.begin();
          if (next) {
            setSummary(next);
          } else {
            void selectMember(memberId);
          }
          loadAudit(memberId);
          void refreshRecent();
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
            const ticket = summaryGate.begin();
            setBanner(null);
            showToast(`${rewardName} diklaim`, "success", {
              duration: 6000,
              actionLabel: "Batalkan",
              onAction: () => {
                const undoTicket = summaryGate.begin();
                void voidClaim({ claimId }).then(async (result) => {
                  if (result.status !== "ok") {
                    showToast("Klaim nggak bisa dibatalin.", "error");
                    return;
                  }
                  await reloadSummary(memberId, undoTicket);
                  await refreshRecent();
                }).catch(() => {
                  showToast("Klaim nggak bisa dibatalin. Koneksi putus.", "error");
                });
              },
            });
            void reloadSummary(memberId, ticket).then(refreshRecent);
          }}
        />
      ) : null}
      <AlertDialog open={rotateOpen} onOpenChange={(next) => !rotatePending && setRotateOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti link kartu?</AlertDialogTitle>
            <AlertDialogDescription>
              Link lama langsung mati. Customer perlu link yang baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotatePending}>Batal</AlertDialogCancel>
            <Button
              type="button"
              disabled={rotatePending}
              onClick={() => {
                if (!summary) return;
                const memberId = summary.id;
                const ticket = summaryGate.begin();
                setRotatePending(true);
                void rotateCardToken({ memberId }).then(async (result) => {
                  setRotatePending(false);
                  setRotateOpen(false);
                  if (result.status === "ok") {
                    if (summaryGate.isLatest(ticket)) {
                      setSummary((current) => (current?.id === memberId ? result.summary : current));
                    }
                    showToast("Link kartu diganti", "success");
                    return;
                  }
                  if (result.status === "rotated") {
                    await reloadSummary(memberId, ticket);
                    showToast("Link kartu diganti. Muat ulang kartu kalau salin link masih yang lama.", "success");
                    return;
                  }
                  showToast("Link belum diganti. Koneksi putus.", "error");
                }).catch(() => {
                  setRotatePending(false);
                  showToast("Link belum diganti. Koneksi putus.", "error");
                });
              }}
            >
              {rotatePending ? "Mengganti…" : "Ya, ganti link"}
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
      subtitle: `Klaim ${member.last_claim_name}`,
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

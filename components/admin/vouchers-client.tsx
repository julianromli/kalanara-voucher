"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Ticket01Icon,
  Search01Icon,
  FilterIcon,
  Clock01Icon,
  Tick02Icon,
  CancelCircleIcon,
  AlertCircleIcon,
  Loading03Icon,
  CalendarAdd01Icon,
  Cancel01Icon,
  QrCode01Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import {
  AlertTriangle,
  Ban,
  CalendarPlus,
  QrCode,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  deleteVoucher,
  redeemVoucher,
  extendVoucher,
  voidVoucher,
  type VoucherAdminListRow,
  type VoucherAdminSummary,
} from "@/lib/actions/vouchers";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminPageBody,
  AdminPageIntro,
  AdminStatButton,
  AdminSurface,
} from "@/components/admin/admin-page";
import { AdminRowOverflowMenu } from "@/components/admin/admin-row-overflow-menu";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import { useAdminListUrl } from "@/hooks/use-admin-list-url";
import { cn } from "@/lib/utils";

type VoucherStatus = "ALL" | "ACTIVE" | "REDEEMED" | "EXPIRED";

function getVoucherStatus(
  voucher: VoucherAdminListRow,
): "active" | "redeemed" | "expired" {
  if (voucher.is_redeemed) return "redeemed";
  if (new Date(voucher.expiry_date) < new Date()) return "expired";
  return "active";
}

const STATUS_CONFIG: Record<
  "active" | "redeemed" | "expired",
  { label: string; color: string; icon: IconSvgElement }
> = {
  active: {
    label: "Aktif",
    color: "bg-primary/10 text-primary",
    icon: Clock01Icon,
  },
  redeemed: {
    label: "Terpakai",
    color: "bg-primary/10 text-primary",
    icon: Tick02Icon,
  },
  expired: {
    label: "Kedaluwarsa",
    color: "bg-destructive/10 text-destructive",
    icon: CancelCircleIcon,
  },
};

interface VouchersClientProps {
  initialPage: AdminPage<VoucherAdminListRow>;
  initialSummary: VoucherAdminSummary;
}

const EXTEND_DAYS_SELECT_ID = "voucher-extend-days";

export function VouchersClient({
  initialPage,
  initialSummary,
}: VouchersClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [vouchers, setVouchers] =
    useState<VoucherAdminListRow[]>(initialPage.rows);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filter: statusFilter,
    setFilter: setStatusFilter,
    setPage,
  } = useAdminListUrl({
    filterParam: "status",
  });

  // Action states
  const [selectedVoucher, setSelectedVoucher] =
    useState<VoucherAdminListRow | null>(null);
  const [actionType, setActionType] = useState<
    "redeem" | "extend" | "void" | null
  >(null);
  const [pendingDeleteVoucher, setPendingDeleteVoucher] =
    useState<VoucherAdminListRow | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeletingVoucher, setIsDeletingVoucher] = useState<string | null>(
    null,
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

  const setOptimistic = (id: string, active: boolean) => {
    setOptimisticIds((prev) => {
      const next = new Set(prev);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    setVouchers(initialPage.rows);
  }, [initialPage.rows]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openActionDialog = (
    voucher: VoucherAdminListRow,
    action: "redeem" | "extend" | "void",
  ) => {
    setSelectedVoucher(voucher);
    setActionType(action);
    setExtendDays(30);
  };

  const closeActionDialog = () => {
    setSelectedVoucher(null);
    setActionType(null);
  };

  const closeDeleteDialog = () => {
    if (isDeletingVoucher) {
      return;
    }

    setPendingDeleteVoucher(null);
  };

  const handleAction = async () => {
    if (!selectedVoucher || !actionType) return;

    setIsProcessing(true);

    const previous = vouchers;
    const voucherId = selectedVoucher.id;
    let message = "An error occurred";

    const optimisticList = vouchers.map((voucher) => {
      if (voucher.id !== voucherId) return voucher;

      if (actionType === "redeem") {
        return {
          ...voucher,
          is_redeemed: true,
          redeemed_at: new Date().toISOString(),
        };
      }

      if (actionType === "extend") {
        const currentExpiry = new Date(voucher.expiry_date);
        currentExpiry.setDate(currentExpiry.getDate() + extendDays);
        return {
          ...voucher,
          expiry_date: currentExpiry.toISOString(),
        };
      }

      return {
        ...voucher,
        expiry_date: new Date("2000-01-01").toISOString(),
      };
    });

    setVouchers(optimisticList);
    setOptimistic(voucherId, true);

    try {
      let success = false;

      switch (actionType) {
        case "redeem": {
          const result = await redeemVoucher(selectedVoucher.code);
          success = result.success;
          message = result.message;
          break;
        }
        case "extend": {
          success = await extendVoucher(selectedVoucher.id, extendDays);
          message = success
            ? `Voucher extended by ${extendDays} days`
            : "Failed to extend voucher";
          break;
        }
        case "void": {
          success = await voidVoucher(selectedVoucher.id);
          message = success
            ? "Voucher voided successfully"
            : "Failed to void voucher";
          break;
        }
      }

      if (success) {
        showToast(message, "success");
        router.refresh();
      } else {
        setVouchers(previous);
        showToast(message || "An error occurred", "error");
      }
    } catch {
      setVouchers(previous);
      showToast("An error occurred", "error");
    } finally {
      setIsProcessing(false);
      setOptimistic(selectedVoucher.id, false);
      closeActionDialog();
    }
  };

  const handleDeleteVoucher = async () => {
    if (!pendingDeleteVoucher || isDeletingVoucher) {
      return;
    }

    const voucherId = pendingDeleteVoucher.id;
    const previous = vouchers;

    setIsDeletingVoucher(voucherId);
    setOptimistic(voucherId, true);
    setVouchers((currentVouchers) =>
      currentVouchers.filter((voucher) => voucher.id !== voucherId),
    );

    try {
      const result = await deleteVoucher(voucherId);

      if (!result.success) {
        setVouchers(previous);
        showToast(result.message, "error");
        return;
      }

      if (selectedVoucher?.id === voucherId) {
        closeActionDialog();
      }

      showToast(result.message, "success");
      setPendingDeleteVoucher(null);
      router.refresh();
      if (vouchers.length === 1 && initialPage.page > 1) {
        setPage(initialPage.page - 1);
      }
    } catch {
      setVouchers(previous);
      showToast("Failed to delete voucher permanently.", "error");
    } finally {
      setIsDeletingVoucher(null);
      setOptimistic(voucherId, false);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  const stats = {
    total:
      initialSummary.active +
      initialSummary.redeemed +
      initialSummary.expired,
    active: initialSummary.active,
    redeemed: initialSummary.redeemed,
    expired: initialSummary.expired,
  };

  return (
    <>
      <DashboardHeader title="Voucher" showActions={false} />
      <AdminPageBody>
        <AdminPageIntro description="Pantau status, perpanjang masa berlaku, tukarkan, atau batalkan voucher." />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <AdminStatButton
            label="Total"
            value={stats.total}
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          />
          <AdminStatButton
            label="Aktif"
            value={stats.active}
            active={statusFilter === "ACTIVE"}
            onClick={() => setStatusFilter("ACTIVE")}
          />
          <AdminStatButton
            label="Terpakai"
            value={stats.redeemed}
            active={statusFilter === "REDEEMED"}
            onClick={() => setStatusFilter("REDEEMED")}
          />
          <AdminStatButton
            label="Kedaluwarsa"
            value={stats.expired}
            active={statusFilter === "EXPIRED"}
            onClick={() => setStatusFilter("EXPIRED")}
            tone="danger"
          />
        </div>

        <AdminSurface>
          <AdminFilterBar>
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Cari kode, penerima, email, atau layanan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as VoucherStatus)}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <HugeiconsIcon icon={FilterIcon} size={16} className="mr-2" />
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua status</SelectItem>
                <SelectItem value="ACTIVE">Aktif</SelectItem>
                <SelectItem value="REDEEMED">Terpakai</SelectItem>
                <SelectItem value="EXPIRED">Kedaluwarsa</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterBar>
        </AdminSurface>

        {vouchers.length === 0 ? (
          <AdminSurface padded={false}>
            <AdminEmptyState
              icon={<HugeiconsIcon icon={Ticket01Icon} size={22} />}
              title="Tidak ada voucher"
              description={
                searchQuery || statusFilter !== "ALL"
                  ? "Coba kata atau status lain."
                  : "Voucher muncul setelah ada pembelian."
              }
            />
            <AdminListPagination
              itemLabel="voucher"
              page={initialPage.page}
              totalCount={initialPage.totalCount}
              totalPages={initialPage.totalPages}
              onPageChange={setPage}
            />
          </AdminSurface>
        ) : (
          <AdminSurface padded={false}>
            <div className="space-y-3 p-4 md:hidden">
              {vouchers.map((voucher) => {
                const status = getVoucherStatus(voucher);
                return (
                  <article key={voucher.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/admin/purchases?query=${encodeURIComponent(voucher.code)}`}
                          className="font-mono text-sm font-medium text-foreground hover:underline"
                        >
                          {voucher.code}
                        </Link>
                        <p className="mt-1 font-medium">{voucher.services?.name || "Layanan"}</p>
                        <p className="text-sm text-muted-foreground">{voucher.recipient_name}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs ${STATUS_CONFIG[status].color}`}>
                        {STATUS_CONFIG[status].label}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium tabular-nums">{formatCurrency(voucher.amount)}</p>
                      {status === "active" ? (
                        <Button type="button" size="sm" className="min-h-11" onClick={() => openActionDialog(voucher, "redeem")}>
                          Tukarkan
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Kode
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Layanan
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Penerima
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Nilai
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Berlaku
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vouchers.map((voucher) => {
                    const isOptimistic = optimisticIds.has(voucher.id);
                    const status = getVoucherStatus(voucher);
                    const config = STATUS_CONFIG[status];
                    const isDeleteBusy = isDeletingVoucher === voucher.id;
                    const isActionBusy =
                      isOptimistic ||
                      isDeleteBusy ||
                      (isProcessing && selectedVoucher?.id === voucher.id);

                    return (
                      <tr
                        key={voucher.id}
                        className={cn(
                          "transition-colors row-hover-lift",
                          isOptimistic && "opacity-70 saturate-50",
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/purchases?query=${encodeURIComponent(voucher.code)}`}
                              className="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground hover:underline"
                            >
                              {voucher.code}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(voucher.code)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label={`Copy voucher code ${voucher.code}`}
                            >
                              {copiedCode === voucher.code ? (
                                <HugeiconsIcon
                                  icon={Tick02Icon}
                                  size={14}
                                  className="text-success"
                                />
                              ) : (
                                <HugeiconsIcon icon={Copy01Icon} size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-foreground font-medium">
                            {voucher.services?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {voucher.services?.duration || 0} menit
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-foreground">
                            {voucher.recipient_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {voucher.recipient_email}
                          </p>
                        </td>
                        <td className="p-4 font-medium text-foreground tabular-nums">
                          {formatCurrency(voucher.amount)}
                        </td>
                        <td className="p-4">
                          <p className="text-muted-foreground">
                            {new Date(voucher.expiry_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {(() => {
                                const days = Math.ceil(
                                  (new Date(voucher.expiry_date).getTime() - Date.now()) /
                                    86_400_000,
                                );
                                if (days < 0) return "Sudah lewat";
                                if (days === 0) return "Hari ini";
                                return `${days} hari lagi`;
                              })()}
                            </span>
                          </p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.color}`}
                          >
                            <HugeiconsIcon icon={config.icon} size={12} />
                            {config.label}
                          </span>
                          {isOptimistic && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <HugeiconsIcon
                                icon={Loading03Icon}
                                size={12}
                                className="animate-spin"
                              />
                              Menyinkronkan
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            <AdminRowOverflowMenu
                              label={`Open actions for ${voucher.code}`}
                              busy={isDeleteBusy}
                              disabled={isActionBusy}
                            >
                                  {status === "active" ? (
                                    <>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          openActionDialog(voucher, "redeem")
                                        }
                                      >
                                        <QrCode />
                                        Tukarkan
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          openActionDialog(voucher, "extend")
                                        }
                                      >
                                        <CalendarPlus />
                                        Perpanjang
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() =>
                                          openActionDialog(voucher, "void")
                                        }
                                      >
                                        <Ban />
                                        Batalkan
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  ) : null}
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() =>
                                      setPendingDeleteVoucher(voucher)
                                    }
                                  >
                                    <Trash2 />
                                    Hapus
                                  </DropdownMenuItem>
                            </AdminRowOverflowMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <AdminListPagination
              itemLabel="voucher"
              page={initialPage.page}
              totalCount={initialPage.totalCount}
              totalPages={initialPage.totalPages}
              onPageChange={setPage}
            />
          </AdminSurface>
        )}
      </AdminPageBody>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => closeActionDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans font-semibold text-xl flex items-center gap-2">
              {actionType === "redeem" && (
                <>
                  <HugeiconsIcon
                    icon={QrCode01Icon}
                    size={20}
                    className="text-primary"
                  />
                  Tukarkan voucher
                </>
              )}
              {actionType === "extend" && (
                <>
                  <HugeiconsIcon
                    icon={CalendarAdd01Icon}
                    size={20}
                    className="text-primary"
                  />
                  Perpanjang voucher
                </>
              )}
              {actionType === "void" && (
                <>
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={20}
                    className="text-destructive"
                  />
                  Batalkan voucher
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionType === "redeem" &&
                "Tandai voucher ini sudah dipakai. Tindakan ini tidak bisa dibatalkan."}
              {actionType === "extend" &&
                "Perpanjang tanggal berlaku voucher ini."}
              {actionType === "void" &&
                "Batalkan voucher ini. Voucher langsung kedaluwarsa dan tidak bisa dipakai."}
            </DialogDescription>
          </DialogHeader>

          {selectedVoucher && (
            <div className="py-4">
              <div className="bg-muted rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="font-mono font-bold text-foreground">
                    {selectedVoucher.code}
                  </code>
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatCurrency(selectedVoucher.amount)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedVoucher.services?.name} •{" "}
                  {selectedVoucher.recipient_name}
                </p>
              </div>

              {actionType === "extend" && (
                <div className="space-y-3">
                  <label
                    htmlFor={EXTEND_DAYS_SELECT_ID}
                    className="block text-sm text-muted-foreground"
                  >
                    Tambah hari berlaku
                  </label>
                  <Select
                    value={String(extendDays)}
                    onValueChange={(v) => setExtendDays(Number(v))}
                  >
                    <SelectTrigger id={EXTEND_DAYS_SELECT_ID}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 hari</SelectItem>
                      <SelectItem value="14">14 hari</SelectItem>
                      <SelectItem value="30">30 hari</SelectItem>
                      <SelectItem value="60">60 hari</SelectItem>
                      <SelectItem value="90">90 hari</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Berlaku sampai:{" "}
                    {new Date(
                      new Date(selectedVoucher.expiry_date).getTime() +
                        extendDays * 24 * 60 * 60 * 1000,
                    ).toLocaleDateString("id-ID")}
                  </p>
                </div>
              )}

              {actionType === "void" && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={20}
                    className="text-destructive shrink-0 mt-0.5"
                  />
                  <p className="text-sm text-destructive">
                    Tindakan ini tidak bisa dibatalkan. Voucher langsung kedaluwarsa.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={closeActionDialog}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              onClick={handleAction}
              disabled={isProcessing}
              className={
                actionType === "void"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary/90"
              }
            >
              {isProcessing ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="mr-1 animate-spin"
                />
              ) : null}
              {actionType === "redeem" && "Ya, tukarkan"}
              {actionType === "extend" && "Perpanjang"}
              {actionType === "void" && "Batalkan voucher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteVoucher)}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Hapus voucher permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Voucher dan ulasan terkait akan terhapus. Pembelian tetap ada,
              tanpa detail voucher.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDeleteVoucher ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-foreground">
                {pendingDeleteVoucher.recipient_name}
              </p>
              <p className="font-mono text-muted-foreground">
                {pendingDeleteVoucher.code}
              </p>
              <p className="mt-2 text-muted-foreground">
                {pendingDeleteVoucher.services?.name || "Unknown"} •{" "}
                {formatCurrency(pendingDeleteVoucher.amount)}
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(isDeletingVoucher)}>
              Batal
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={Boolean(isDeletingVoucher)}
              onClick={handleDeleteVoucher}
            >
              {isDeletingVoucher ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Trash2 />
              )}
              Hapus permanen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

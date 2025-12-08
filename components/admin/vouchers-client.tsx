"use client";

import { useEffect, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
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
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  redeemVoucher,
  extendVoucher,
  voidVoucher,
} from "@/lib/actions/vouchers";
import type { VoucherWithService } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type VoucherStatus = "ALL" | "ACTIVE" | "REDEEMED" | "EXPIRED";

function getVoucherStatus(voucher: VoucherWithService): "active" | "redeemed" | "expired" {
  if (voucher.is_redeemed) return "redeemed";
  if (new Date(voucher.expiry_date) < new Date()) return "expired";
  return "active";
}

const STATUS_CONFIG: Record<"active" | "redeemed" | "expired", { label: string; color: string; icon: IconSvgElement }> = {
  active: {
    label: "Active",
    color: "bg-primary/10 text-primary",
    icon: Clock01Icon,
  },
  redeemed: {
    label: "Redeemed",
    color: "bg-primary/10 text-primary",
    icon: Tick02Icon,
  },
  expired: {
    label: "Expired",
    color: "bg-destructive/10 text-destructive",
    icon: CancelCircleIcon,
  },
};

interface VouchersClientProps {
  initialVouchers: VoucherWithService[];
}

export function VouchersClient({ initialVouchers }: VouchersClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [vouchers, setVouchers] = useState<VoucherWithService[]>(initialVouchers);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VoucherStatus>("ALL");

  // Action states
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherWithService | null>(null);
  const [actionType, setActionType] = useState<"redeem" | "extend" | "void" | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
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
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const filteredVouchers = vouchers.filter((voucher) => {
    const status = getVoucherStatus(voucher);
    const matchesSearch =
      voucher.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voucher.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voucher.recipient_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || status.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const openActionDialog = (voucher: VoucherWithService, action: "redeem" | "extend" | "void") => {
    setSelectedVoucher(voucher);
    setActionType(action);
    setExtendDays(30);
  };

  const closeActionDialog = () => {
    setSelectedVoucher(null);
    setActionType(null);
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
          message = success ? "Voucher voided successfully" : "Failed to void voucher";
          break;
        }
      }

      if (success) {
        showToast(message, "success");
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

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const stats = {
    total: vouchers.length,
    active: vouchers.filter((v) => getVoucherStatus(v) === "active").length,
    redeemed: vouchers.filter((v) => getVoucherStatus(v) === "redeemed").length,
    expired: vouchers.filter((v) => getVoucherStatus(v) === "expired").length,
  };

  return (
    <>
      <DashboardHeader title="Voucher Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={cn(
            "bg-card rounded-xl p-4 shadow-spa border border-border card-hover-lift",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-sans font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className={cn(
            "bg-card rounded-xl p-4 shadow-spa border border-border card-hover-lift",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )} style={{ animationDelay: "75ms" }}>
            <p className="text-sm text-primary flex items-center gap-1">
              <HugeiconsIcon icon={Clock01Icon} size={14} /> Active
            </p>
            <p className="text-2xl font-sans font-semibold text-foreground">{stats.active}</p>
          </div>
          <div className={cn(
            "bg-card rounded-xl p-4 shadow-spa border border-border card-hover-lift",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )} style={{ animationDelay: "150ms" }}>
            <p className="text-sm text-primary flex items-center gap-1">
              <HugeiconsIcon icon={Tick02Icon} size={14} /> Redeemed
            </p>
            <p className="text-2xl font-sans font-semibold text-foreground">{stats.redeemed}</p>
          </div>
          <div className={cn(
            "bg-card rounded-xl p-4 shadow-spa border border-border card-hover-lift",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )} style={{ animationDelay: "225ms" }}>
            <p className="text-sm text-destructive flex items-center gap-1">
              <HugeiconsIcon icon={CancelCircleIcon} size={14} /> Expired
            </p>
            <p className="text-2xl font-sans font-semibold text-foreground">{stats.expired}</p>
          </div>
        </div>

        {/* Filters */}
        <div className={cn(
          "bg-card rounded-2xl shadow-spa border border-border p-4 mb-6",
          isMounted ? "animate-fade-slide-up" : "opacity-0"
        )} style={{ animationDelay: "300ms" }}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by code, recipient..."
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
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="REDEEMED">Redeemed</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Vouchers Table */}
        {filteredVouchers.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-spa border border-border p-12 text-center">
            <HugeiconsIcon icon={Ticket01Icon} size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No vouchers found
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Vouchers will appear here when customers make purchases"}
            </p>
          </div>
        ) : (
          <div 
            className={cn(
              "bg-card rounded-2xl shadow-spa border border-border overflow-hidden",
              isMounted ? "animate-fade-slide-up" : "opacity-0"
            )}
            style={{ animationDelay: "400ms" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Code
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Service
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Recipient
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Value
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Expiry
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVouchers.map((voucher, index) => {
                    const isOptimistic = optimisticIds.has(voucher.id);
                    const status = getVoucherStatus(voucher);
                    const config = STATUS_CONFIG[status];
                    const StatusIcon = config.icon;

                    return (
                      <tr
                        key={voucher.id}
                        className={cn(
                          "hover:bg-accent/50 transition-colors row-hover-lift",
                          isOptimistic && "opacity-70 saturate-50",
                          isMounted ? "animate-fade-slide-up" : "opacity-0"
                        )}
                        style={{ animationDelay: `${500 + index * 50}ms` }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-foreground bg-muted px-2 py-1 rounded">
                              {voucher.code}
                            </code>
                            <button
                              onClick={() => handleCopyCode(voucher.code)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedCode === voucher.code ? (
                                <HugeiconsIcon icon={Tick02Icon} size={14} className="text-success" />
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
                            {voucher.services?.duration || 0} mins
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-foreground">{voucher.recipient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {voucher.recipient_email}
                          </p>
                        </td>
                        <td className="p-4 font-medium text-foreground">
                          {formatCurrency(voucher.amount)}
                        </td>
                        <td className="p-4">
                          <p className="text-muted-foreground">
                            {new Date(voucher.expiry_date).toLocaleDateString()}
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
                              <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                              Syncing
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {status === "active" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "redeem")}
                                  disabled={isOptimistic}
                                  className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                  title="Redeem"
                                >
                                  <HugeiconsIcon icon={QrCode01Icon} size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "extend")}
                                  disabled={isOptimistic}
                                  className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                  title="Extend"
                                >
                                  <HugeiconsIcon icon={CalendarAdd01Icon} size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "void")}
                                  disabled={isOptimistic}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Void"
                                >
                                  <HugeiconsIcon icon={Cancel01Icon} size={16} />
                                </Button>
                              </>
                            )}
                            {status !== "active" && (
                              <span className="text-xs text-muted-foreground px-2">
                                No actions
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => closeActionDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans font-semibold text-xl flex items-center gap-2">
              {actionType === "redeem" && (
                <>
                  <HugeiconsIcon icon={QrCode01Icon} size={20} className="text-primary" />
                  Redeem Voucher
                </>
              )}
              {actionType === "extend" && (
                <>
                  <HugeiconsIcon icon={CalendarAdd01Icon} size={20} className="text-primary" />
                  Extend Voucher
                </>
              )}
              {actionType === "void" && (
                <>
                  <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-destructive" />
                  Void Voucher
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionType === "redeem" &&
                "Mark this voucher as redeemed. This action cannot be undone."}
              {actionType === "extend" &&
                "Extend the expiry date of this voucher."}
              {actionType === "void" &&
                "Void this voucher. This will immediately expire it and cannot be undone."}
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
                  {selectedVoucher.services?.name} • {selectedVoucher.recipient_name}
                </p>
              </div>

              {actionType === "extend" && (
                <div className="space-y-3">
                  <label className="block text-sm text-muted-foreground">
                    Extend by (days)
                  </label>
                  <Select
                    value={String(extendDays)}
                    onValueChange={(v) => setExtendDays(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    New expiry:{" "}
                    {new Date(
                      new Date(selectedVoucher.expiry_date).getTime() +
                        extendDays * 24 * 60 * 60 * 1000
                    ).toLocaleDateString()}
                  </p>
                </div>
              )}

              {actionType === "void" && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <HugeiconsIcon icon={AlertCircleIcon} size={20} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    Warning: This action is irreversible. The voucher will be
                    immediately marked as expired and cannot be used.
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
              Cancel
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
                <HugeiconsIcon icon={Loading03Icon} size={16} className="mr-1 animate-spin" />
              ) : null}
              {actionType === "redeem" && "Confirm Redemption"}
              {actionType === "extend" && "Extend Voucher"}
              {actionType === "void" && "Void Voucher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

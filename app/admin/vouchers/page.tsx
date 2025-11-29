"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  CalendarPlus,
  Ban,
  ScanLine,
  Copy,
  Check,
} from "lucide-react";
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
import {
  getVouchers,
  redeemVoucher,
  extendVoucher,
  voidVoucher,
} from "@/lib/actions/vouchers";
import type { VoucherWithService } from "@/lib/database.types";

type VoucherStatus = "ALL" | "ACTIVE" | "REDEEMED" | "EXPIRED";

function getVoucherStatus(voucher: VoucherWithService): "active" | "redeemed" | "expired" {
  if (voucher.is_redeemed) return "redeemed";
  if (new Date(voucher.expiry_date) < new Date()) return "expired";
  return "active";
}

const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "bg-emerald-100 text-emerald-700",
    icon: Clock,
  },
  redeemed: {
    label: "Redeemed",
    color: "bg-blue-100 text-blue-700",
    icon: CheckCircle,
  },
  expired: {
    label: "Expired",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

export default function AdminVouchersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [vouchers, setVouchers] = useState<VoucherWithService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VoucherStatus>("ALL");

  // Action states
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherWithService | null>(null);
  const [actionType, setActionType] = useState<"redeem" | "extend" | "void" | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    async function fetchVouchers() {
      const data = await getVouchers();
      setVouchers(data);
      setLoading(false);
    }
    if (isAuthenticated) {
      fetchVouchers();
    }
  }, [isAuthenticated]);

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

    try {
      let success = false;
      let message = "";

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
        const updated = await getVouchers();
        setVouchers(updated);
      } else {
        showToast(message, "error");
      }
    } catch {
      showToast("An error occurred", "error");
    } finally {
      setIsProcessing(false);
      closeActionDialog();
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-sage-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-sand-300" size={32} />
      </div>
    );
  }

  const stats = {
    total: vouchers.length,
    active: vouchers.filter((v) => getVoucherStatus(v) === "active").length,
    redeemed: vouchers.filter((v) => getVoucherStatus(v) === "redeemed").length,
    expired: vouchers.filter((v) => getVoucherStatus(v) === "expired").length,
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-sage-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Ticket size={24} className="text-sand-400" />
            <h1 className="font-sans font-semibold text-2xl text-sand-100">
              Voucher Management
            </h1>
          </div>
          <p className="text-sage-400 mt-2">
            View and manage all vouchers, redeem, extend, or void them
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-spa border border-sage-100">
            <p className="text-sm text-sage-500">Total</p>
            <p className="text-2xl font-sans font-semibold text-sage-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-spa border border-sage-100">
            <p className="text-sm text-emerald-600 flex items-center gap-1">
              <Clock size={14} /> Active
            </p>
            <p className="text-2xl font-sans font-semibold text-sage-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-spa border border-sage-100">
            <p className="text-sm text-blue-600 flex items-center gap-1">
              <CheckCircle size={14} /> Redeemed
            </p>
            <p className="text-2xl font-sans font-semibold text-sage-900">{stats.redeemed}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-spa border border-sage-100">
            <p className="text-sm text-red-600 flex items-center gap-1">
              <XCircle size={14} /> Expired
            </p>
            <p className="text-2xl font-sans font-semibold text-sage-900">{stats.expired}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
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
                <Filter size={16} className="mr-2" />
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-sage-500" size={32} />
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-12 text-center">
            <Ticket size={48} className="text-sage-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-sage-700 mb-2">
              No vouchers found
            </h3>
            <p className="text-sage-500">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Vouchers will appear here when customers make purchases"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-spa border border-sage-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sage-100 bg-sage-50/50">
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Code
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Service
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Recipient
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Value
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Expiry
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-sage-600">
                      Status
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-sage-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {filteredVouchers.map((voucher) => {
                    const status = getVoucherStatus(voucher);
                    const config = STATUS_CONFIG[status];
                    const StatusIcon = config.icon;

                    return (
                      <tr
                        key={voucher.id}
                        className="hover:bg-sage-50/50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-sage-800 bg-sage-100 px-2 py-1 rounded">
                              {voucher.code}
                            </code>
                            <button
                              onClick={() => handleCopyCode(voucher.code)}
                              className="text-sage-400 hover:text-sage-600 transition-colors"
                            >
                              {copiedCode === voucher.code ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sage-800 font-medium">
                            {voucher.services?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-sage-500">
                            {voucher.services?.duration || 0} mins
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sage-800">{voucher.recipient_name}</p>
                          <p className="text-xs text-sage-500">
                            {voucher.recipient_email}
                          </p>
                        </td>
                        <td className="p-4 font-medium text-sage-800">
                          {formatCurrency(voucher.amount)}
                        </td>
                        <td className="p-4">
                          <p className="text-sage-700">
                            {new Date(voucher.expiry_date).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${config.color}`}
                          >
                            <StatusIcon size={12} />
                            {config.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {status === "active" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "redeem")}
                                  className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="Redeem"
                                >
                                  <ScanLine size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "extend")}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Extend"
                                >
                                  <CalendarPlus size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openActionDialog(voucher, "void")}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Void"
                                >
                                  <Ban size={16} />
                                </Button>
                              </>
                            )}
                            {status !== "active" && (
                              <span className="text-xs text-sage-400 px-2">
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
                  <ScanLine size={20} className="text-emerald-600" />
                  Redeem Voucher
                </>
              )}
              {actionType === "extend" && (
                <>
                  <CalendarPlus size={20} className="text-blue-600" />
                  Extend Voucher
                </>
              )}
              {actionType === "void" && (
                <>
                  <Ban size={20} className="text-red-600" />
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
              <div className="bg-sage-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="font-mono font-bold text-sage-800">
                    {selectedVoucher.code}
                  </code>
                  <span className="text-sm font-medium text-sage-700">
                    {formatCurrency(selectedVoucher.amount)}
                  </span>
                </div>
                <p className="text-sm text-sage-600">
                  {selectedVoucher.services?.name} • {selectedVoucher.recipient_name}
                </p>
              </div>

              {actionType === "extend" && (
                <div className="space-y-3">
                  <label className="block text-sm text-sage-700">
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
                  <p className="text-xs text-sage-500">
                    New expiry:{" "}
                    {new Date(
                      new Date(selectedVoucher.expiry_date).getTime() +
                        extendDays * 24 * 60 * 60 * 1000
                    ).toLocaleDateString()}
                  </p>
                </div>
              )}

              {actionType === "void" && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    Warning: This action is irreversible. The voucher will be
                    immediately marked as expired and cannot be used.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-sage-100">
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
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "redeem"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            >
              {isProcessing ? (
                <Loader2 size={16} className="mr-1 animate-spin" />
              ) : null}
              {actionType === "redeem" && "Confirm Redemption"}
              {actionType === "extend" && "Extend Voucher"}
              {actionType === "void" && "Void Voucher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

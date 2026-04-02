"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Clock,
  CreditCard,
  Hash,
  Loader2,
  Trash2,
  Wallet,
} from "lucide-react";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { deleteOrderHard, clearAllOrdersHard } from "@/lib/actions/orders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OrderWithVoucher } from "@/lib/database.types";

interface PurchasesClientProps {
  initialOrders: OrderWithVoucher[];
  canUpdatePaymentStatus: boolean;
  canDeletePurchases: boolean;
}

type DeleteMode = "single" | "all" | null;

function getStatusBadgeVariant(status: OrderWithVoucher["payment_status"]) {
  if (status === "COMPLETED") {
    return "default" as const;
  }

  if (status === "PENDING") {
    return "secondary" as const;
  }

  return "destructive" as const;
}

export function PurchasesClient({
  initialOrders,
  canUpdatePaymentStatus,
  canDeletePurchases,
}: PurchasesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithVoucher | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<OrderWithVoucher | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_email.toLowerCase().includes(searchLower) ||
      order.payment_order_id?.toLowerCase().includes(searchLower) ||
      order.payment_transaction_id?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "ALL" || order.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const closeDeleteDialog = () => {
    if (isDeletingOrder || isClearingAll) {
      return;
    }

    setDeleteMode(null);
    setPendingDeleteOrder(null);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (isUpdatingStatus || isDeletingOrder || isClearingAll) {
      return;
    }

    const previousOrders = [...orders];
    const optimisticOrders = orders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            payment_status: newStatus as OrderWithVoucher["payment_status"],
          }
        : order
    );

    setIsUpdatingStatus(orderId);
    setOrders(optimisticOrders);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      showToast("Payment status updated successfully.", "success");
    } catch (error) {
      setOrders(previousOrders);
      console.error("Failed to update order status:", error);
      showToast("Failed to update payment status.", "error");
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!pendingDeleteOrder || isDeletingOrder || isClearingAll) {
      return;
    }

    setIsDeletingOrder(pendingDeleteOrder.id);

    try {
      const result = await deleteOrderHard(pendingDeleteOrder.id);

      if (!result.success) {
        showToast(result.message, "error");
        return;
      }

      setOrders((currentOrders) => currentOrders.filter((order) => order.id !== pendingDeleteOrder.id));

      if (selectedOrder?.id === pendingDeleteOrder.id) {
        setSelectedOrder(null);
      }

      showToast(result.message, "success");
      setDeleteMode(null);
      setPendingDeleteOrder(null);
    } catch (error) {
      console.error("Failed to hard delete purchase:", error);
      showToast("Failed to delete purchase permanently.", "error");
    } finally {
      setIsDeletingOrder(null);
    }
  };

  const handleClearAllOrders = async () => {
    if (isClearingAll || isDeletingOrder) {
      return;
    }

    setIsClearingAll(true);

    try {
      const result = await clearAllOrdersHard();

      if (!result.success) {
        showToast(result.message, "error");
        return;
      }

      setOrders([]);
      setSelectedOrder(null);
      showToast(result.message, "success");
      setDeleteMode(null);
      setPendingDeleteOrder(null);
    } catch (error) {
      console.error("Failed to clear purchases:", error);
      showToast("Failed to clear purchases permanently.", "error");
    } finally {
      setIsClearingAll(false);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  const isDeleteDialogOpen = deleteMode !== null;
  const isDeleteBusy = Boolean(isDeletingOrder) || isClearingAll;

  return (
    <>
      <DashboardHeader title="Purchases Management" showActions={false} />
      <div className="h-full w-full overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="text-sm text-muted-foreground">
              Manage customer voucher purchases and payment status.
            </p>

            {canDeletePurchases ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setPendingDeleteOrder(null);
                  setDeleteMode("all");
                }}
                disabled={orders.length === 0 || isDeleteBusy || Boolean(isUpdatingStatus)}
              >
                {isClearingAll ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Clear All Purchases
              </Button>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-spa">
            <div className="mb-4 flex flex-col gap-4 md:flex-row">
              <Input
                placeholder="Search purchases..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Voucher Code</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                        No purchases found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const isStatusBusy = isUpdatingStatus === order.id;
                      const isRowDeleteBusy = isDeletingOrder === order.id;

                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.customer_name}</p>
                              <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs text-muted-foreground">
                              {order.payment_order_id || "-"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-sm">{order.vouchers?.code || "Pending"}</p>
                          </TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>
                            <p className="text-sm uppercase">{order.payment_provider || "-"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm capitalize">
                              {(order.scalev_payment_method || order.payment_type)?.replace(/_/g, " ") || "-"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(order.payment_status)}>
                              {order.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {canUpdatePaymentStatus && order.payment_status === "PENDING" ? (
                                <Button
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                                  disabled={isStatusBusy || isDeleteBusy}
                                  className="bg-success text-success-foreground hover:bg-success/90"
                                >
                                  {isStatusBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                                  Complete
                                </Button>
                              ) : null}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedOrder(order)}
                                disabled={isDeleteBusy}
                              >
                                Details
                              </Button>

                              {canDeletePurchases ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setPendingDeleteOrder(order);
                                    setDeleteMode("single");
                                  }}
                                  disabled={isDeleteBusy || isStatusBusy}
                                >
                                  {isRowDeleteBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
            <DialogDescription>
              Review customer, voucher, and payment information for this purchase.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">Customer</h4>
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">Order</h4>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Service</span>
                    <span className="text-right font-medium">
                      {selectedOrder.vouchers?.services?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium uppercase">{selectedOrder.payment_provider || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={getStatusBadgeVariant(selectedOrder.payment_status)}>
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Voucher Code</span>
                    <span className="font-mono text-sm">{selectedOrder.vouchers?.code || "Pending"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="size-4" />
                  Payment Transaction
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Hash className="size-3.5" />
                      Order ID
                    </span>
                    <span className="max-w-[200px] break-all text-right font-mono text-xs">
                      {selectedOrder.payment_order_id || "-"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Hash className="size-3.5" />
                      Transaction ID
                    </span>
                    <span className="max-w-[200px] break-all text-right font-mono text-xs">
                      {selectedOrder.payment_transaction_id || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Wallet className="size-3.5" />
                      Payment Type
                    </span>
                    <span className="text-right capitalize">
                      {(selectedOrder.scalev_payment_method || selectedOrder.payment_type)?.replace(/_/g, " ") || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Building2 className="size-3.5" />
                      External Order
                    </span>
                    <span className="max-w-[200px] break-all text-right font-mono text-xs">
                      {selectedOrder.scalev_order_id || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Hash className="size-3.5" />
                      PG Reference
                    </span>
                    <span className="max-w-[200px] break-all text-right font-mono text-xs">
                      {selectedOrder.scalev_pg_reference_id || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" />
                      Transaction Time
                    </span>
                    <span className="text-right text-sm">
                      {selectedOrder.payment_transaction_time
                        ? new Date(selectedOrder.payment_transaction_time).toLocaleString("id-ID")
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Created: {new Date(selectedOrder.created_at).toLocaleString("id-ID")}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle>
                  {deleteMode === "all" ? "Clear all purchases?" : "Delete purchase permanently?"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {deleteMode === "all"
                    ? "This will permanently delete every purchase along with related vouchers, reviews, and webhook history. This action cannot be undone."
                    : "This will permanently delete the selected purchase and any related voucher, review, and webhook history. This action cannot be undone."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteMode === "single" && pendingDeleteOrder ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-foreground">{pendingDeleteOrder.customer_name}</p>
              <p className="text-muted-foreground">{pendingDeleteOrder.customer_email}</p>
              <p className="mt-2 text-muted-foreground">
                Order ID: <span className="font-mono">{pendingDeleteOrder.payment_order_id || pendingDeleteOrder.id}</span>
              </p>
            </div>
          ) : null}

          {deleteMode === "all" ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
              {orders.length} purchase{orders.length === 1 ? "" : "s"} will be removed from the admin view after the server confirms the hard delete.
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeleteBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteMode === "all" ? handleClearAllOrders : handleDeleteOrder}
              disabled={isDeleteBusy}
              className={cn(deleteMode === "all" ? "min-w-[170px]" : "min-w-[160px]")}
            >
              {isDeleteBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleteMode === "all" ? "Clear All Permanently" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

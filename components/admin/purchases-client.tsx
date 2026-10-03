"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCheck,
  Clock,
  CreditCard,
  Hash,
  Loader2,
  Trash2,
  Wallet,
} from "lucide-react";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { AdminListPagination } from "@/components/admin/admin-list-pagination";
import {
  AdminFilterBar,
  AdminPageBody,
  AdminPageIntro,
  AdminSurface,
} from "@/components/admin/admin-page";
import { AdminRowOverflowMenu } from "@/components/admin/admin-row-overflow-menu";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useAdminListUrl } from "@/hooks/use-admin-list-url";
import type { AdminPage } from "@/lib/actions/admin-pagination";
import { formatCurrency } from "@/lib/constants";
import { deleteOrderHard, clearAllOrdersHard } from "@/lib/actions/orders";
import { sortOrderItems } from "@/lib/orderItems";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { buyerPath, formatBuyerPhone } from "@/lib/admin/buyer-phone";
import { cn } from "@/lib/utils";
import type { OrderWithVoucherItems } from "@/lib/database.types";

interface PurchasesClientProps {
  initialPage: AdminPage<OrderWithVoucherItems>;
  initialTotalCount: number;
  canUpdatePaymentStatus: boolean;
  canDeletePurchases: boolean;
  focusedOrder?: OrderWithVoucherItems | null;
}

type DeleteMode = "single" | "all" | null;

function getStatusBadgeVariant(status: OrderWithVoucherItems["payment_status"]) {
  if (status === "COMPLETED") {
    return "default" as const;
  }

  if (status === "PENDING") {
    return "secondary" as const;
  }

  return "destructive" as const;
}

function getStatusBadgeClassName(status: OrderWithVoucherItems["payment_status"]) {
  if (status === "COMPLETED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "PENDING") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300";
  }

  return "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/10";
}

function getOrderServiceSummary(order: OrderWithVoucherItems) {
  const orderItems = sortOrderItems(order.order_items);
  if (orderItems.length === 0) {
    return order.vouchers?.services?.name || "N/A";
  }

  if (orderItems.length === 1) {
    return orderItems[0].services?.name || order.vouchers?.services?.name || "N/A";
  }

  const firstServiceName =
    orderItems[0].services?.name || order.vouchers?.services?.name || "Voucher";
  return `${firstServiceName} +${orderItems.length - 1} lainnya`;
}

function getOrderVoucherSummary(order: OrderWithVoucherItems) {
  const orderItems = sortOrderItems(order.order_items);
  if (orderItems.length === 0) {
    return order.vouchers?.code || "Pending";
  }

  const fulfilledCount = orderItems.filter((item) => Boolean(item.voucher_id)).length;
  if (orderItems.length === 1) {
    return orderItems[0].vouchers?.code || "Pending";
  }

  if (fulfilledCount === orderItems.length) {
    return `${orderItems.length} voucher`;
  }

  if (fulfilledCount === 0) {
    return "Pending";
  }

  return `${fulfilledCount}/${orderItems.length} voucher`;
}

export function PurchasesClient({
  initialPage,
  initialTotalCount,
  canUpdatePaymentStatus,
  canDeletePurchases,
  focusedOrder = null,
}: PurchasesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState(initialPage.rows);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filter: statusFilter,
    setFilter: setStatusFilter,
    setPage,
  } = useAdminListUrl({
    filterParam: "status",
  });
  const [selectedOrder, setSelectedOrder] = useState<OrderWithVoucherItems | null>(
    null,
  );
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] =
    useState<OrderWithVoucherItems | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [pendingCompleteOrder, setPendingCompleteOrder] =
    useState<OrderWithVoucherItems | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (focusedOrder) {
      setSelectedOrder(focusedOrder);
    }
  }, [focusedOrder]);

  useEffect(() => {
    setOrders(initialPage.rows);
  }, [initialPage.rows]);

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
            payment_status: newStatus as OrderWithVoucherItems["payment_status"],
          }
        : order,
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

      showToast("Status pembayaran diperbarui.", "success");
      if (
        statusFilter === "PENDING" &&
        orders.length === 1 &&
        initialPage.page > 1 &&
        initialPage.page === initialPage.totalPages
      ) {
        setPage(initialPage.page - 1);
      }
      router.refresh();
    } catch (error) {
      setOrders(previousOrders);
      console.error("Failed to update order status:", error);
      showToast("Gagal memperbarui status pembayaran.", "error");
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

      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== pendingDeleteOrder.id),
      );

      if (selectedOrder?.id === pendingDeleteOrder.id) {
        setSelectedOrder(null);
      }

      showToast(result.message, "success");
      setDeleteMode(null);
      setPendingDeleteOrder(null);
      router.refresh();
      if (orders.length === 1 && initialPage.page > 1) {
        setPage(initialPage.page - 1);
      }
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
      router.refresh();
      setPage(1);
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
      <DashboardHeader title="Penjualan" showActions={false} />
      <AdminPageBody>
        <AdminPageIntro description="Pantau pembelian voucher dan status pembayaran." />

        <AdminSurface>
          <AdminFilterBar className="mb-4">
            <Input
              placeholder="Cari nama, WhatsApp, email, atau kode voucher"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="flex-1"
            />
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua status</SelectItem>
                <SelectItem value="PENDING">Menunggu</SelectItem>
                <SelectItem value="COMPLETED">Lunas</SelectItem>
                <SelectItem value="FAILED">Gagal</SelectItem>
                <SelectItem value="REFUNDED">Dikembalikan</SelectItem>
              </SelectContent>
            </Select>
          </AdminFilterBar>

            <div className="space-y-3 p-4 md:hidden">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Tidak ada penjualan.
                </p>
              ) : (
                orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={buyerPath(order.customer_phone)} className="font-medium hover:underline">
                          {order.customer_name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatBuyerPhone(order.customer_phone)}
                        </p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 min-h-11 w-full"
                      onClick={() => setSelectedOrder(order)}
                    >
                      Detail
                    </Button>
                  </article>
                ))
              )}
            </div>
            <div className="hidden md:block">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pembeli</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada penjualan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => {
                      const isStatusBusy = isUpdatingStatus === order.id;
                      const isRowDeleteBusy = isDeletingOrder === order.id;
                      const voucherLabel = getOrderVoucherSummary(order);
                      const voucherQuery = voucherLabel.startsWith("KSP-")
                        ? voucherLabel
                        : "";

                      return (
                        <TableRow key={order.id} className="border-border/70">
                          <TableCell>
                            <Link
                              href={buyerPath(order.customer_phone)}
                              className="font-medium text-foreground hover:underline"
                            >
                              {order.customer_name}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {formatBuyerPhone(order.customer_phone)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs text-muted-foreground">
                              {order.payment_order_id || "-"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {voucherQuery ? (
                              <Link
                                href={`/admin/vouchers?query=${encodeURIComponent(voucherQuery)}`}
                                className="font-mono text-sm hover:underline"
                              >
                                {voucherLabel}
                              </Link>
                            ) : (
                              <p className="font-mono text-sm">{voucherLabel}</p>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatCurrency(order.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(
                                order.payment_status,
                              )}
                              className={getStatusBadgeClassName(
                                order.payment_status,
                              )}
                            >
                              {order.payment_status === "PENDING"
                                ? "Menunggu"
                                : order.payment_status === "COMPLETED"
                                  ? "Lunas"
                                  : order.payment_status === "FAILED"
                                    ? "Gagal"
                                    : "Dikembalikan"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                onClick={() => setSelectedOrder(order)}
                              >
                                Detail
                              </Button>
                              <AdminRowOverflowMenu
                                label={`Buka aksi ${order.payment_order_id || order.customer_name}`}
                                busy={isStatusBusy || isRowDeleteBusy}
                                disabled={isStatusBusy || isDeleteBusy}
                              >
                                <DropdownMenuItem
                                  onSelect={() => setSelectedOrder(order)}
                                >
                                  <ArrowUpRight />
                                  Detail
                                </DropdownMenuItem>
                                {canUpdatePaymentStatus &&
                                order.payment_status === "PENDING" ? (
                                  <DropdownMenuItem
                                    onSelect={() => setPendingCompleteOrder(order)}
                                  >
                                    <CheckCheck />
                                    Tandai lunas
                                  </DropdownMenuItem>
                                ) : null}
                                {canDeletePurchases ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => {
                                        setPendingDeleteOrder(order);
                                        setDeleteMode("single");
                                      }}
                                    >
                                      <Trash2 />
                                      Hapus
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </AdminRowOverflowMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {canDeletePurchases ? (
              <div className="border-t border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPendingDeleteOrder(null);
                    setDeleteMode("all");
                  }}
                  disabled={
                    initialTotalCount === 0 ||
                    isDeleteBusy ||
                    Boolean(isUpdatingStatus)
                  }
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {isClearingAll ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Hapus semua penjualan
                </Button>
              </div>
            ) : null}
            <AdminListPagination
              itemLabel="pembelian"
              page={initialPage.page}
              totalCount={initialPage.totalCount}
              totalPages={initialPage.totalPages}
              onPageChange={setPage}
              disabled={
                Boolean(isUpdatingStatus) ||
                Boolean(isDeletingOrder) ||
                isClearingAll
              }
            />
          </AdminSurface>
      </AdminPageBody>

      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail penjualan</DialogTitle>
            <DialogDescription>
              Pembeli, voucher, dan pembayaran untuk transaksi ini.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                  Pembeli
                </h4>
                <Link
                  href={buyerPath(selectedOrder.customer_phone)}
                  className="font-medium hover:underline"
                >
                  {selectedOrder.customer_name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.customer_email}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatBuyerPhone(selectedOrder.customer_phone)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11"
                  onClick={() => {
                    void navigator.clipboard.writeText(selectedOrder.customer_phone);
                    showToast("Nomor WhatsApp disalin.", "success");
                  }}
                >
                  Salin WhatsApp
                </Button>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                  Pesanan
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Layanan</span>
                    <span className="text-right font-medium">
                      {getOrderServiceSummary(selectedOrder)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Item</span>
                    <span className="font-medium">
                      {selectedOrder.order_items.length || 1}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Jumlah</span>
                    <span className="font-medium">
                      {formatCurrency(selectedOrder.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium uppercase">
                      {selectedOrder.payment_provider || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={getStatusBadgeVariant(
                        selectedOrder.payment_status,
                      )}
                    >
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Kode voucher</span>
                    <span className="font-mono text-sm">
                      {getOrderVoucherSummary(selectedOrder)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  Voucher Items
                </h4>
                <div className="space-y-3">
                  {sortOrderItems(selectedOrder.order_items).map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {index + 1}. {item.services?.name || "Voucher"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Recipient: {item.recipient_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Delivery: {item.delivery_method} to{" "}
                            {item.send_to === "RECIPIENT" ? "recipient" : "purchaser"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {item.vouchers?.code || "Pending"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedOrder.order_items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This order uses the legacy single-voucher structure.
                    </p>
                  ) : null}
                </div>
              </div>

              <details className="rounded-xl bg-muted/50 p-4">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="size-4" />
                  Detail pembayaran
                </summary>
                <div className="mt-3">
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
                      {(
                        selectedOrder.scalev_payment_method ||
                        selectedOrder.payment_type
                      )?.replace(/_/g, " ") || "-"}
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
                        ? new Date(
                            selectedOrder.payment_transaction_time,
                          ).toLocaleString("id-ID")
                        : "-"}
                    </span>
                  </div>
                </div>
                </div>
              </details>

              <div className="text-xs text-muted-foreground">
                <p>
                  Dibuat:{" "}
                  {new Date(selectedOrder.created_at).toLocaleString("id-ID")}
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedOrder(null)}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingCompleteOrder)}
        onOpenChange={(open) => !open && setPendingCompleteOrder(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tandai lunas?</DialogTitle>
            <DialogDescription>
              Status pembayaran {pendingCompleteOrder?.customer_name} menjadi lunas.
              Lakukan ini hanya jika pembayaran sudah diterima.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCompleteOrder(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!pendingCompleteOrder) return;
                const orderId = pendingCompleteOrder.id;
                setPendingCompleteOrder(null);
                void updateOrderStatus(orderId, "COMPLETED");
              }}
            >
              Ya, tandai lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle>
                  {deleteMode === "all"
                    ? "Hapus semua penjualan?"
                    : "Hapus penjualan permanen?"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {deleteMode === "all"
                    ? "Semua penjualan, voucher terkait, ulasan, dan riwayat webhook akan terhapus. Tindakan ini tidak bisa dibatalkan."
                    : "Penjualan ini beserta voucher, ulasan, dan riwayat webhook terkait akan terhapus. Tindakan ini tidak bisa dibatalkan."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteMode === "single" && pendingDeleteOrder ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-foreground">
                {pendingDeleteOrder.customer_name}
              </p>
              <p className="text-muted-foreground">
                {pendingDeleteOrder.customer_email}
              </p>
              <p className="mt-2 text-muted-foreground">
                Order ID:{" "}
                <span className="font-mono">
                  {pendingDeleteOrder.payment_order_id || pendingDeleteOrder.id}
                </span>
              </p>
            </div>
          ) : null}

          {deleteMode === "all" ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
              {initialTotalCount} pembelian akan dihapus permanen.
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isDeleteBusy}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={
                deleteMode === "all" ? handleClearAllOrders : handleDeleteOrder
              }
              disabled={isDeleteBusy}
              className={cn(
                deleteMode === "all" ? "min-w-[170px]" : "min-w-[160px]",
              )}
            >
              {isDeleteBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleteMode === "all"
                ? "Hapus semua permanen"
                : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

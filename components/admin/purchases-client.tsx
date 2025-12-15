"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, CreditCard, Clock, Hash, Wallet } from "lucide-react";
import type { OrderWithVoucher } from "@/lib/database.types";

interface PurchasesClientProps {
  initialOrders: OrderWithVoucher[];
}

export function PurchasesClient({ initialOrders }: PurchasesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithVoucher | null>(null);

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
      order.midtrans_order_id?.toLowerCase().includes(searchLower) ||
      order.midtrans_transaction_id?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "ALL" || order.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const previousOrders = [...orders];
    const optimisticOrders = orders.map(order =>
      order.id === orderId ? { ...order, payment_status: newStatus as any } : order
    );
    setOrders(optimisticOrders);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      setOrders(previousOrders);
      console.error('Failed to update order status:', error);
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Purchases Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Manage customer voucher purchases and payment status
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-spa border border-border p-4">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Input
                placeholder="Search purchases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg"
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
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">
                          {order.midtrans_order_id || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{order.vouchers?.code || "Pending"}</p>
                      </TableCell>
                      <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell>
                        <p className="text-sm capitalize">
                          {order.midtrans_payment_type?.replace(/_/g, " ") || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          order.payment_status === 'COMPLETED' ? 'default' :
                          order.payment_status === 'PENDING' ? 'secondary' :
                          'destructive'
                        }>
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {order.payment_status === 'PENDING' && (
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Complete
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-lg">Detail Pesanan</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrder(null)}
              >
                <X size={20} />
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Customer Info */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Customer</h4>
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
              </div>

              {/* Order Info */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Order</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{selectedOrder.vouchers?.services?.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={
                      selectedOrder.payment_status === 'COMPLETED' ? 'default' :
                      selectedOrder.payment_status === 'PENDING' ? 'secondary' :
                      'destructive'
                    }>
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voucher Code</span>
                    <span className="font-mono text-sm">{selectedOrder.vouchers?.code || "Pending"}</span>
                  </div>
                </div>
              </div>

              {/* Midtrans Transaction Info */}
              <div className="bg-muted/50 rounded-xl p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <CreditCard size={16} />
                  Midtrans Transaction
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Hash size={14} />
                      Order ID
                    </span>
                    <span className="font-mono text-xs text-right break-all max-w-[200px]">
                      {selectedOrder.midtrans_order_id || "-"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Hash size={14} />
                      Transaction ID
                    </span>
                    <span className="font-mono text-xs text-right break-all max-w-[200px]">
                      {selectedOrder.midtrans_transaction_id || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Wallet size={14} />
                      Payment Type
                    </span>
                    <span className="capitalize">
                      {selectedOrder.midtrans_payment_type?.replace(/_/g, " ") || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock size={14} />
                      Transaction Time
                    </span>
                    <span className="text-sm">
                      {selectedOrder.midtrans_transaction_time 
                        ? new Date(selectedOrder.midtrans_transaction_time).toLocaleString("id-ID")
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground">
                <p>Created: {new Date(selectedOrder.created_at).toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedOrder(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

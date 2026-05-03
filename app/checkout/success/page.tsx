"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Store,
  RefreshCcw,
  Copy,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { downloadPDF, generateVoucherPDF } from "@/lib/pdf";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";
import { isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { useCartStore } from "@/store/cart-store";

type PublicVoucher = NonNullable<PublicOrderStatusPayload["vouchers"]>[number];
const INVALID_LINK_MESSAGE = "Link status pembayaran tidak valid atau sudah kedaluwarsa.";

function getDeliverySummary(
  sendTo: SendTo,
  deliveryMethod: DeliveryMethod
): string {
  if (sendTo === SendTo.PURCHASER) {
    switch (deliveryMethod) {
      case DeliveryMethod.WHATSAPP:
        return "Voucher dikirim ke WhatsApp kamu";
      case DeliveryMethod.EMAIL:
        return "Voucher dikirim ke email kamu";
      case DeliveryMethod.BOTH:
        return "Voucher dikirim ke email dan WhatsApp kamu";
    }
  }

  switch (deliveryMethod) {
    case DeliveryMethod.WHATSAPP:
      return "Voucher dikirim ke WhatsApp penerima";
    case DeliveryMethod.EMAIL:
      return "Voucher dikirim ke email penerima";
    case DeliveryMethod.BOTH:
      return "Voucher dikirim ke email dan WhatsApp penerima";
  }
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = searchParams.get("order_id");
  const token = searchParams.get("token");
  const completePendingCheckout = useCartStore((state) => state.completePendingCheckout);
  const clearPendingCheckout = useCartStore((state) => state.clearPendingCheckout);
  const hasValidAccessLink = Boolean(orderId && token);

  const [payload, setPayload] = useState<PublicOrderStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(hasValidAccessLink);
  const [error, setError] = useState<string | null>(
    hasValidAccessLink ? null : INVALID_LINK_MESSAGE
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const paymentLink = payload?.paymentLink;
  const paymentInstructions = payload?.paymentInstructions;
  const vouchers = useMemo(() => {
    if (payload?.vouchers?.length) {
      return payload.vouchers;
    }

    return payload?.voucher ? [payload.voucher] : [];
  }, [payload]);
  const isMultiVoucher = vouchers.length > 1;

  const fetchStatus = useCallback(async () => {
    if (!orderId || !token) {
      throw new Error(INVALID_LINK_MESSAGE);
    }

    const response = await fetch("/api/orders/public-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ orderId, token }),
    });

    if (!response.ok) {
      throw new Error("Gagal memuat status pesanan.");
    }

    return (await response.json()) as PublicOrderStatusPayload;
  }, [orderId, token]);

  useEffect(() => {
    if (!hasValidAccessLink) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 12;

    const poll = async () => {
      try {
        const result = await fetchStatus();
        if (!result || cancelled) return;

        setPayload(result);
        setError(null);
        setIsLoading(false);

        if (result.status === "completed" || result.status === "failed") {
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setError("Kami belum menerima konfirmasi terbaru. Cek lagi beberapa saat lagi.");
          setIsLoading(false);
          return;
        }

        timeoutId = setTimeout(poll, 2500);
      } catch (pollError) {
        console.error("Public status polling failed:", pollError);
        if (!cancelled) {
          setError("Kami belum menerima konfirmasi terbaru. Cek lagi beberapa saat lagi.");
          setIsLoading(false);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchStatus, hasValidAccessLink, refreshKey]);

  useEffect(() => {
    if (!orderId || !payload) {
      return;
    }

    if (payload.status === "completed") {
      completePendingCheckout(orderId);
      return;
    }

    if (payload.status === "failed") {
      clearPendingCheckout(orderId);
    }
  }, [clearPendingCheckout, completePendingCheckout, orderId, payload]);

  const handleCheckStatusAgain = () => {
    if (!hasValidAccessLink) {
      return;
    }
    setError(null);
    setIsLoading(true);
    setRefreshKey((value) => value + 1);
  };

  const handleDownloadPDF = async (voucher: PublicVoucher) => {
    try {
      const blob = await generateVoucherPDF({
        code: voucher.voucherCode,
        serviceName: voucher.serviceName,
        recipientName: voucher.recipientName,
        senderName: voucher.senderName,
        senderMessage: voucher.senderMessage || undefined,
        expiryDate: voucher.expiryDate,
      });
      downloadPDF(blob, `kalanara-voucher-${voucher.voucherCode}.pdf`);
    } catch (downloadError) {
      console.error("Failed to generate PDF:", downloadError);
      showToast("Gagal membuat PDF. Silakan coba lagi.", "error");
    }
  };

  const handleOpenPaymentPage = () => {
    if (!paymentLink) {
      showToast("Link pembayaran belum tersedia.", "error");
      return;
    }

    window.open(paymentLink, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="mb-4 size-12 animate-spin text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Memuat status pembayaran...</h1>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
          Kami sedang mengecek status pesanan dan menyiapkan voucher kamu.
        </p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertCircle className="mb-4 size-14 text-destructive" />
        <h1 className="text-2xl font-semibold text-foreground">Status belum tersedia</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleCheckStatusAgain}>Cek Lagi</Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = payload?.status === "completed" && vouchers.length > 0;
  const isFailed = payload?.status === "failed";
  const isHostedPaymentLink =
    paymentLink && isScalevHostedPublicOrderUrl(paymentLink);

  if (!isCompleted && !isFailed && payload?.orderDetails) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Store className="size-5" />
              Kalanara Spa
            </div>
            <div className="rounded bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              Pending
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white shadow-sm">
            {/* Order Info */}
            <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Order ID</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-semibold text-foreground">{payload.orderId}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(payload.orderId);
                      showToast("Order ID disalin", "success");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Salin Order ID"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(payload.orderDetails.createdAt).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).replace(" pukul", ",")}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <div className="mt-1 flex items-center gap-1 sm:justify-end">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(payload.orderDetails!.totalAmount.toString());
                      showToast("Total disalin", "success");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Salin Total"
                  >
                    <Copy className="size-3.5" />
                  </button>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(payload.orderDetails.totalAmount)}
                  </p>
                </div>
                <p className="mt-1 text-xs font-medium text-info hover:underline cursor-pointer" onClick={() => window.location.reload()}>
                  Lihat Riwayat Status Pemesanan
                </p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="border-b border-border bg-muted/30 p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Nama Pemesan</p>
                  <p className="mt-1 font-medium text-foreground">{payload.orderDetails.customerName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">No. Telepon Pemesan</p>
                  <p className="mt-1 font-medium text-foreground">
                    {payload.orderDetails.customerPhone.replace(/(\d{3})\d+(\d{3})/, '$1***$2')}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="mt-1 font-medium text-foreground">{payload.orderDetails.customerEmail}</p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="border-b border-border p-6">
              <div className="space-y-4">
                {payload.orderDetails.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-foreground">{item.serviceName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Kuantitas: {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 font-semibold text-foreground">
                <p>Total</p>
                <p>{formatCurrency(payload.orderDetails.totalAmount)}</p>
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-muted/30 p-6 rounded-b-xl">
              <div className="mb-6 flex justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status Pembayaran</p>
                  <p className="mt-1 font-semibold text-warning">Unpaid</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">Metode Pembayaran</p>
                  <p className="mt-1 font-semibold text-foreground">{payload.paymentMethod || "QRIS"}</p>
                </div>
              </div>

              {paymentInstructions?.kind === "qris" ? (
                <div className="text-center">
                  <div className="mx-auto w-fit rounded-xl bg-card p-3 border border-border">
                    <QRCode value={paymentInstructions.qrString} size={220} />
                  </div>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    Powered by <span className="font-bold text-foreground">QRIS</span>
                  </p>
                  <Button 
                    className="mt-6 w-full bg-info hover:bg-info/90 text-info-foreground"
                    onClick={() => {
                      showToast("Fitur download QR Code akan segera tersedia", "info");
                    }}
                  >
                    Download QR Code
                  </Button>
                </div>
              ) : isHostedPaymentLink ? (
                <div className="mt-6 text-center">
                  <Button className="w-full bg-info hover:bg-info/90 text-info-foreground" onClick={handleOpenPaymentPage}>
                    Buka Halaman Pembayaran
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          
          <Button 
            className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90" 
            onClick={handleCheckStatusAgain}
          >
            <RefreshCcw className="mr-2 size-4" />
            Cek Status Pembayaran
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-spa sm:p-8">
          <div className="text-center">
            {isCompleted ? (
              <CheckCircle className="mx-auto mb-4 size-16 text-success" />
            ) : isFailed ? (
              <AlertCircle className="mx-auto mb-4 size-16 text-destructive" />
            ) : (
              <Loader2 className="mx-auto mb-4 size-16 animate-spin text-primary" />
            )}

            <h1 className="font-sans text-3xl font-semibold text-foreground">
              {isCompleted
                ? "Voucher Berhasil Dibuat"
                : isFailed
                  ? "Pembayaran Tidak Berhasil"
                  : "Menunggu Pembayaran"}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              {isCompleted
                ? isMultiVoucher
                  ? "Semua voucher di pesanan ini sudah siap digunakan."
                  : "Voucher kamu sudah siap digunakan."
                : payload?.message || "Selesaikan pembayaran untuk menerima voucher."}
            </p>
          </div>

          {error && !isCompleted && !isFailed ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          {isHostedPaymentLink && !isCompleted && !isFailed ? (
            <div className="mt-6 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              Jika pembayaran belum selesai, buka kembali halaman pembayaran dari tombol di bawah.
            </div>
          ) : null}

          {paymentInstructions?.kind === "qris" && !isCompleted && !isFailed ? (
            <div className="mt-8 rounded-2xl border border-border bg-background p-5 text-center">
              <p className="text-sm font-medium text-foreground">Scan QRIS untuk membayar</p>
              <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-4">
                <QRCode value={paymentInstructions.qrString} size={220} />
              </div>
              {paymentInstructions.amount ? (
                <p className="mt-4 font-semibold text-foreground">
                  {formatCurrency(paymentInstructions.amount)}
                </p>
              ) : null}
            </div>
          ) : null}

          {!isCompleted && !isFailed ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {paymentLink ? (
                <Button onClick={handleOpenPaymentPage}>Buka Halaman Pembayaran</Button>
              ) : null}
              <Button variant="outline" onClick={handleCheckStatusAgain}>
                Cek Status Lagi
              </Button>
            </div>
          ) : null}

          {isCompleted ? (
            <>
              <div className="mt-8 space-y-4">
                {vouchers.map((voucher, index) => (
                  <article
                    key={voucher.voucherCode}
                    className="rounded-2xl border border-border bg-background p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Voucher {index + 1}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-foreground">
                          {voucher.serviceName}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Untuk {voucher.recipientName} • {voucher.serviceDuration} menit
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {getDeliverySummary(voucher.sendTo, voucher.deliveryMethod)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground">
                        <p className="text-xs uppercase tracking-[0.16em] opacity-80">
                          Kode
                        </p>
                        <p className="font-mono text-lg font-bold tracking-wider">
                          {voucher.voucherCode}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-muted-foreground">Nilai</p>
                        <p className="font-medium text-foreground">
                          {formatCurrency(voucher.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Berlaku sampai</p>
                        <p className="font-medium text-foreground">
                          {new Date(voucher.expiryDate).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(voucher)}
                        >
                          <Download className="mr-2 size-4" />
                          Download PDF
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { downloadPDF, generateVoucherPDF } from "@/lib/pdf";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";
import { isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";
import { DeliveryMethod, SendTo } from "@/lib/types";

type PublicVoucher = NonNullable<PublicOrderStatusPayload["vouchers"]>[number];

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

  const [payload, setPayload] = useState<PublicOrderStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError("Link status pembayaran tidak valid atau sudah kedaluwarsa.");
      setIsLoading(false);
      return;
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
    if (!orderId || !token) {
      setError("Link status pembayaran tidak valid atau sudah kedaluwarsa.");
      setIsLoading(false);
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

    setIsLoading(true);
    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchStatus, orderId, refreshKey, token]);

  const handleCheckStatusAgain = () => {
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
  const showHostedPaymentNotice =
    paymentLink && isScalevHostedPublicOrderUrl(paymentLink);
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
              {paymentLink && !showHostedPaymentNotice ? (
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

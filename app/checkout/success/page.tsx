"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Mail,
  MessageCircle,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { downloadPDF, generateVoucherPDF } from "@/lib/pdf";
import type { PublicOrderStatusPayload } from "@/lib/scalev/types";
import { isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = searchParams.get("order_id");
  const token = searchParams.get("token");

  const [payload, setPayload] = useState<PublicOrderStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paymentLink = payload?.paymentLink;
  const paymentInstructions = payload?.paymentInstructions;

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
        const response = await fetch("/api/orders/public-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            orderId,
            token,
          }),
        });

        if (!response.ok) {
          throw new Error("Gagal memuat status pesanan.");
        }

        const result = (await response.json()) as PublicOrderStatusPayload;
        if (cancelled) return;

        setPayload(result);
        setIsLoading(false);

        if (result.status === "completed" || result.status === "failed") {
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setError(
            "Pembayaran masih diverifikasi. Silakan cek lagi beberapa saat lagi."
          );
          setIsLoading(false);
          return;
        }

        timeoutId = setTimeout(poll, 2500);
      } catch (pollError) {
        console.error("Public status polling failed:", pollError);
        if (!cancelled) {
          setError("Terjadi kesalahan saat memeriksa status pembayaran.");
          setIsLoading(false);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [orderId, token]);

  const voucher = payload?.voucher;

  const handleDownloadPDF = async () => {
    if (!voucher) return;

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

  const handleResendWhatsApp = () => {
    if (!voucher || !orderId || !token) return;

    void (async () => {
      try {
        const response = await fetch("/api/whatsapp/send-voucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            token,
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          whatsappUrl?: string;
          error?: string;
        };

        if (!response.ok || !result.success || !result.whatsappUrl) {
          throw new Error(result.error || "Gagal menyiapkan WhatsApp.");
        }

        window.open(result.whatsappUrl, "_blank");
      } catch (whatsappError) {
        console.error("Failed to resend WhatsApp:", whatsappError);
        showToast("Gagal menyiapkan WhatsApp. Silakan coba lagi.", "error");
      }
    })();
  };

  const handleResendEmail = async () => {
    if (!voucher?.recipientEmail || !orderId || !token) {
      showToast("Email penerima tidak tersedia.", "error");
      return;
    }

    try {
      const response = await fetch("/api/email/send-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengirim email");
      }

      showToast("Email berhasil dikirim ulang.", "success");
    } catch (emailError) {
      console.error("Failed to resend email:", emailError);
      showToast("Gagal mengirim email. Silakan coba lagi.", "error");
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
        <h2 className="text-xl font-semibold text-foreground">
          Memproses Pembayaran...
        </h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Mohon tunggu sebentar, kami sedang memverifikasi pembayaran dan
          menyiapkan voucher Anda.
        </p>
      </div>
    );
  }

  if (error || payload?.status === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-4 rounded-full bg-muted p-4">
          <AlertCircle className="size-12 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Verifikasi Pembayaran
        </h2>
        <p className="mb-6 max-w-md text-center text-muted-foreground">
          {error || payload?.message || "Pembayaran masih diverifikasi."}
        </p>
        {paymentInstructions?.kind === "qris" ? (
          <div className="mb-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <p className="text-sm font-medium text-foreground">Scan QRIS untuk membayar</p>
            {paymentInstructions.amount ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Nominal {formatCurrency(paymentInstructions.amount)}
              </p>
            ) : null}
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-border bg-white p-4">
              <QRCode value={paymentInstructions.qrString} size={208} />
            </div>
            {paymentInstructions.expiresAt ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Berlaku sampai{" "}
                {new Date(paymentInstructions.expiresAt).toLocaleString("id-ID")}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex w-full max-w-sm flex-col gap-3">
          {paymentLink && !isScalevHostedPublicOrderUrl(paymentLink) ? (
            <Button onClick={handleOpenPaymentPage}>
              Buka Halaman Pembayaran
            </Button>
          ) : null}
          <Button onClick={() => window.location.reload()}>Coba Lagi</Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    );
  }

  if (payload?.status === "failed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-4 rounded-full bg-destructive/10 p-4">
          <AlertCircle className="size-12 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Pembayaran Tidak Berhasil
        </h2>
        <p className="mb-6 max-w-md text-center text-muted-foreground">
          {payload.message || "Pesanan tidak dapat diselesaikan."}
        </p>
        <Button onClick={() => router.push("/")}>Kembali ke Beranda</Button>
      </div>
    );
  }

  if (!voucher) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-8">
      <div className="animate-scale-in w-full max-w-lg rounded-3xl bg-card p-8 text-center shadow-2xl md:p-12">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted animate-checkmark-pop">
          <CheckCircle size={40} className="text-muted-foreground" />
        </div>

        <h1 className="mb-2 font-sans text-3xl font-semibold text-foreground">
          Pembayaran Berhasil!
        </h1>
        <p className="mb-8 text-muted-foreground">
          Voucher Anda sudah aktif dan siap digunakan.
        </p>

        <div className="mb-6 rounded-2xl bg-background p-6">
          <p className="mb-2 text-sm text-muted-foreground">Order ID</p>
          <p className="break-all font-mono text-lg font-bold tracking-wider text-foreground">
            {voucher.paymentOrderId}
          </p>
        </div>

        <div className="mb-6 rounded-2xl bg-background p-6">
          <p className="mb-2 text-sm text-muted-foreground">Kode Voucher</p>
          <p className="break-all font-mono text-2xl font-bold tracking-wider text-foreground">
            {voucher.voucherCode}
          </p>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="rounded-xl border border-border bg-card p-4">
            <QRCode value={voucher.voucherCode} size={150} />
          </div>
        </div>

        <Button
          onClick={handleDownloadPDF}
          variant="outline"
          className="mb-6 w-full gap-2 border-border text-muted-foreground"
        >
          <Download size={18} />
          Download Voucher PDF
        </Button>

        <div className="mb-6 rounded-xl bg-muted p-4">
          <p className="mb-3 text-sm text-muted-foreground">Kirim Ulang Voucher</p>
          <div className="flex gap-3">
            <Button
              onClick={handleResendEmail}
              disabled={!voucher.recipientEmail}
              variant="outline"
              className="flex-1 gap-2 border-border text-muted-foreground"
            >
              <Mail size={18} />
              Email
            </Button>
            <Button
              onClick={handleResendWhatsApp}
              variant="outline"
              className="flex-1 gap-2 border-success text-success hover:bg-success/10"
            >
              <MessageCircle size={18} />
              WhatsApp
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Kembali ke Beranda
          </Button>
          <Button
            onClick={() => router.push("/verify")}
            variant="outline"
            className="w-full border-border text-muted-foreground"
          >
            Cek Voucher Lain
          </Button>
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

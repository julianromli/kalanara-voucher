"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Image from "next/image";
import {
  Gift,
  User,
  CheckCircle,
  Mail,
  MessageCircle,
  Send,
  Download,
  ChevronLeft,
  Loader2,
  Clock,
} from "lucide-react";
import QRCode from "react-qr-code";
import { generateVoucherPDF, downloadPDF } from "@/lib/pdf";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMidtransSnap } from "@/hooks/useMidtransSnap";
import { generateWhatsAppUrl, WhatsAppVoucherData } from "@/lib/utils/whatsapp";
import type { CreateTransactionRequest, SnapResult } from "@/lib/midtrans/types";

const PHONE_PATTERN = /^(\+62|62|0)[\d\s-]{8,14}$/;

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone: string;
  senderMessage: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
}

interface SuccessData {
  voucherCode: string;
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  senderName: string;
  senderMessage: string;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
  deliveryMethod: DeliveryMethod;
  sendTo: SendTo;
}

interface PendingData {
  orderId: string;
  paymentType: string;
  pdfUrl?: string;
}


export default function CheckoutPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { services } = useStore();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [pendingData, setPendingData] = useState<PendingData | null>(null);
  const [, setCurrentOrderId] = useState<string | null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);
  const formDataRef = useRef<CheckoutForm | null>(null);

  const service = services.find((s) => s.id === id);

  // Midtrans Snap hook
  const { pay, isLoading: isSnapLoading, isReady: isSnapReady, error: snapError } = useMidtransSnap({
    onSuccess: async (result: SnapResult) => {
      console.log("[Checkout] Payment success:", result);
      // Payment successful - webhook will handle voucher creation
      // Show success UI immediately, voucher details will be fetched
      await handlePaymentSuccess(result);
    },
    onPending: (result: SnapResult) => {
      console.log("[Checkout] Payment pending:", result);
      handlePaymentPending(result);
    },
    onError: (result: SnapResult) => {
      console.error("[Checkout] Payment error:", result);
      setIsProcessing(false);
      showToast("Pembayaran gagal. Silakan coba lagi.", "error");
    },
    onClose: () => {
      console.log("[Checkout] Payment popup closed");
      setIsProcessing(false);
      // User closed without completing - they can retry
    },
  });

  // Utility function to announce changes to screen readers
  const announceToScreenReader = (message: string) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = "";
        }
      }, 1000);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    clearErrors,
    setFocus,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      sendTo: SendTo.RECIPIENT,
      deliveryMethod: DeliveryMethod.WHATSAPP,
    },
    mode: "onBlur",
  });

  const sendTo = watch("sendTo");
  const deliveryMethod = watch("deliveryMethod");
  const recipientEmail = watch("recipientEmail");

  // Compute whether to show recipient email field
  const showRecipientEmail =
    (deliveryMethod === DeliveryMethod.EMAIL || deliveryMethod === DeliveryMethod.BOTH) &&
    sendTo === SendTo.RECIPIENT;

  // Trigger validation when field visibility changes
  useEffect(() => {
    if (showRecipientEmail) {
      trigger("recipientEmail");
      announceToScreenReader("Email field is now required for your selected delivery method.");
    } else {
      clearErrors("recipientEmail");
      announceToScreenReader("Email field is no longer required.");
    }
  }, [showRecipientEmail, trigger, clearErrors]);

  // Clear email validation errors when field becomes valid
  useEffect(() => {
    if (showRecipientEmail && recipientEmail && errors.recipientEmail) {
      trigger("recipientEmail");
    }
  }, [recipientEmail, showRecipientEmail, errors.recipientEmail, trigger]);

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Service not found</p>
      </div>
    );
  }


  // Handle successful payment
  const handlePaymentSuccess = async (result: SnapResult) => {
    if (!formDataRef.current || !service) return;
    
    const data = formDataRef.current;
    const targetPhone = data.sendTo === SendTo.PURCHASER ? data.customerPhone : data.recipientPhone;
    const targetName = data.sendTo === SendTo.PURCHASER ? data.customerName : data.recipientName;
    const targetEmail = data.sendTo === SendTo.PURCHASER ? data.customerEmail : (data.recipientEmail || data.customerEmail);

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // For now, show success with order ID - voucher code will be available after webhook processes
    // In production, you might want to poll for voucher creation or use websockets
    setSuccessData({
      voucherCode: "Sedang diproses...", // Will be updated by webhook
      orderId: result.order_id,
      recipientName: targetName,
      recipientEmail: targetEmail || "",
      recipientPhone: targetPhone,
      senderName: data.customerName,
      senderMessage: data.senderMessage,
      serviceName: service.name,
      serviceDuration: service.duration,
      amount: service.price,
      expiryDate: expiryDate.toISOString(),
      deliveryMethod: data.deliveryMethod,
      sendTo: data.sendTo,
    });
    
    setIsSuccess(true);
    setIsProcessing(false);
    showToast("Pembayaran berhasil! Voucher sedang diproses.", "success");
  };

  // Handle pending payment (bank transfer, etc.)
  const handlePaymentPending = (result: SnapResult) => {
    setPendingData({
      orderId: result.order_id,
      paymentType: result.payment_type,
      pdfUrl: result.pdf_url,
    });
    setIsPending(true);
    setIsProcessing(false);
    showToast("Menunggu pembayaran. Silakan selesaikan pembayaran Anda.", "info");
  };

  // Form submission - create transaction and show Snap popup
  const onSubmit = async (data: CheckoutForm) => {
    // Focus on first error field if validation errors exist
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0] as keyof CheckoutForm;
      setFocus(firstErrorField);
      return;
    }

    if (!isSnapReady) {
      showToast("Sistem pembayaran sedang dimuat. Silakan tunggu.", "error");
      return;
    }

    setIsProcessing(true);
    formDataRef.current = data;

    try {
      // Create transaction via API
      const requestBody: CreateTransactionRequest = {
        serviceId: service.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        recipientPhone: data.recipientPhone,
        senderMessage: data.senderMessage,
        deliveryMethod: data.deliveryMethod,
        sendTo: data.sendTo,
      };

      const response = await fetch("/api/midtrans/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!result.success || !result.token) {
        throw new Error(result.error || "Gagal membuat transaksi");
      }

      setCurrentOrderId(result.orderId);
      
      // Open Midtrans Snap popup
      pay(result.token);
    } catch (error) {
      console.error("Checkout error:", error);
      setIsProcessing(false);
      showToast(
        error instanceof Error ? error.message : "Gagal memproses pembayaran. Silakan coba lagi.",
        "error"
      );
    }
  };


  // Resend handlers
  const handleResendWhatsApp = () => {
    if (!successData) return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const whatsappData: WhatsAppVoucherData = {
      recipientPhone: successData.recipientPhone,
      recipientName: successData.recipientName,
      senderName: successData.senderName,
      senderMessage: successData.senderMessage,
      voucherCode: successData.voucherCode,
      serviceName: successData.serviceName,
      serviceDuration: successData.serviceDuration,
      amount: successData.amount,
      expiryDate: successData.expiryDate,
      verifyUrl: `${baseUrl}/verify?code=${successData.voucherCode}`,
    };
    const whatsappUrl = generateWhatsAppUrl(whatsappData);
    window.open(whatsappUrl, "_blank");
  };

  const handleResendEmail = async () => {
    if (!successData) return;
    try {
      await fetch("/api/email/send-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: successData.recipientEmail,
          recipientName: successData.recipientName,
          senderName: successData.senderName,
          senderMessage: successData.senderMessage,
          voucherCode: successData.voucherCode,
          serviceName: successData.serviceName,
          serviceDuration: successData.serviceDuration,
          amount: successData.amount,
          expiryDate: successData.expiryDate,
        }),
      });
      showToast("Email berhasil dikirim ulang!", "success");
    } catch {
      showToast("Gagal mengirim email. Silakan coba lagi.", "error");
    }
  };

  const handleDownloadPDF = async () => {
    if (!successData || !service) return;
    try {
      const blob = await generateVoucherPDF({
        code: successData.voucherCode,
        serviceName: successData.serviceName,
        recipientName: successData.recipientName,
        senderName: successData.senderName,
        senderMessage: successData.senderMessage || undefined,
        expiryDate: successData.expiryDate,
      });
      downloadPDF(blob, `kalanara-voucher-${successData.voucherCode}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      showToast("Gagal membuat PDF. Silakan coba lagi.", "error");
    }
  };

  // Pending payment UI
  if (isPending && pendingData) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="animate-scale-in bg-card rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-warning" />
          </div>
          <h1 className="font-sans font-semibold text-3xl text-foreground mb-2">
            Menunggu Pembayaran
          </h1>
          <p className="text-muted-foreground mb-6">
            Silakan selesaikan pembayaran Anda melalui {pendingData.paymentType}.
          </p>

          <div className="bg-background p-6 rounded-2xl mb-6">
            <p className="text-sm text-muted-foreground mb-2">Order ID</p>
            <p className="font-mono text-lg text-foreground font-bold tracking-wider">
              {pendingData.orderId}
            </p>
          </div>

          {pendingData.pdfUrl && (
            <Button
              onClick={() => window.open(pendingData.pdfUrl, "_blank")}
              variant="outline"
              className="w-full border-border text-muted-foreground gap-2 mb-6"
            >
              <Download size={18} />
              Download Instruksi Pembayaran
            </Button>
          )}

          <p className="text-sm text-muted-foreground mb-6">
            Voucher akan dikirim otomatis setelah pembayaran dikonfirmasi.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
            >
              Kembali ke Beranda
            </Button>
          </div>
        </div>
      </div>
    );
  }


  // Success UI
  if (isSuccess && successData) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="animate-scale-in bg-card rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 animate-checkmark-pop">
            <CheckCircle size={40} className="text-muted-foreground" />
          </div>
          <h1 className="font-sans font-semibold text-3xl text-foreground mb-2">
            Pembayaran Berhasil!
          </h1>
          <p className="text-muted-foreground mb-8">
            Voucher kamu sedang diproses dan akan dikirim ke penerima.
          </p>

          <div className="bg-background p-6 rounded-2xl mb-6">
            <p className="text-sm text-muted-foreground mb-2">Order ID</p>
            <p className="font-mono text-lg text-foreground font-bold tracking-wider">
              {successData.orderId}
            </p>
          </div>

          {successData.voucherCode !== "Sedang diproses..." && (
            <>
              <div className="bg-background p-6 rounded-2xl mb-6">
                <p className="text-sm text-muted-foreground mb-2">Kode Voucher</p>
                <p className="font-mono text-2xl text-foreground font-bold tracking-wider">
                  {successData.voucherCode}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="bg-card p-4 rounded-xl border border-border">
                  <QRCode value={successData.voucherCode} size={150} />
                </div>
              </div>

              {/* Download PDF */}
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="w-full border-border text-muted-foreground gap-2 mb-6"
              >
                <Download size={18} />
                Download Voucher PDF
              </Button>

              {/* Resend Options */}
              <div className="bg-muted p-4 rounded-xl mb-6">
                <p className="text-sm text-muted-foreground mb-3">Kirim Ulang Voucher</p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleResendEmail}
                    variant="outline"
                    className="flex-1 border-border text-muted-foreground gap-2"
                  >
                    <Mail size={18} />
                    Email
                  </Button>
                  <Button
                    onClick={handleResendWhatsApp}
                    variant="outline"
                    className="flex-1 border-success text-success hover:bg-success/10 gap-2"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
            >
              Kembali ke Beranda
            </Button>
            <Button
              onClick={() => router.push("/verify")}
              variant="outline"
              className="w-full border-border text-muted-foreground py-3"
            >
              Cek Voucher Lain
            </Button>
          </div>
        </div>
      </div>
    );
  }


  // Main checkout form
  return (
    <div className="min-h-screen bg-background py-8">
      {/* Screen Reader Announcements Live Region */}
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 mb-6 animate-slide-in-left">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Kembali</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="animate-fade-slide-up font-sans font-semibold text-2xl sm:text-3xl text-foreground mb-6 sm:mb-8 text-center">
          Selesaikan Pembelian
        </h1>

        {/* Snap loading error */}
        {snapError && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
            <p className="text-destructive text-sm">{snapError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8" aria-label="Checkout form">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Customer Details */}
              <div className="animate-fade-slide-up animate-stagger-1 bg-card p-4 sm:p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
                  <User size={20} aria-hidden="true" /> Data Kamu
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Nama Lengkap
                    </label>
                    <Input
                      {...register("customerName", { required: "Nama lengkap wajib diisi" })}
                      placeholder="Nama kamu"
                      aria-invalid={!!errors.customerName}
                      aria-describedby={errors.customerName ? "customerName-error" : undefined}
                      className={`min-h-12 text-base ${errors.customerName ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {errors.customerName?.message && (
                      <p id="customerName-error" className="text-xs text-destructive mt-1">{errors.customerName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: "Email wajib diisi",
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: "Format email tidak valid",
                        },
                      })}
                      type="email"
                      placeholder="your@email.com"
                      aria-invalid={!!errors.customerEmail}
                      aria-describedby={errors.customerEmail ? "customerEmail-error" : undefined}
                      className={`min-h-12 text-base ${errors.customerEmail ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {errors.customerEmail?.message && (
                      <p id="customerEmail-error" className="text-xs text-destructive mt-1">{errors.customerEmail.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      WhatsApp
                    </label>
                    <Input
                      {...register("customerPhone", {
                        required: "Nomor WhatsApp wajib diisi",
                        pattern: {
                          value: PHONE_PATTERN,
                          message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx",
                        },
                      })}
                      placeholder="+62 812 3456 7890"
                      aria-invalid={!!errors.customerPhone}
                      aria-describedby={errors.customerPhone ? "customerPhone-error" : undefined}
                      className={`min-h-12 text-base ${errors.customerPhone ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {errors.customerPhone?.message && (
                      <p id="customerPhone-error" className="text-xs text-destructive mt-1">{errors.customerPhone.message}</p>
                    )}
                  </div>
                </div>
              </div>


              {/* Recipient Details */}
              <div className="animate-fade-slide-up animate-stagger-2 bg-card p-4 sm:p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
                  <Gift size={20} aria-hidden="true" /> Data Penerima
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Nama Penerima
                    </label>
                    <Input
                      {...register("recipientName", { required: "Nama penerima wajib diisi" })}
                      placeholder="Nama penerima voucher"
                      aria-invalid={!!errors.recipientName}
                      aria-describedby={errors.recipientName ? "recipientName-error" : undefined}
                      className={`min-h-12 text-base ${errors.recipientName ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {errors.recipientName?.message && (
                      <p id="recipientName-error" className="text-xs text-destructive mt-1">{errors.recipientName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      WhatsApp Penerima
                    </label>
                    <Input
                      {...register("recipientPhone", {
                        required: "Nomor WhatsApp wajib diisi",
                        pattern: {
                          value: PHONE_PATTERN,
                          message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx",
                        },
                      })}
                      placeholder="+62 812 3456 7890"
                      aria-invalid={!!errors.recipientPhone}
                      aria-describedby={errors.recipientPhone ? "recipientPhone-error" : undefined}
                      className={`min-h-12 text-base ${errors.recipientPhone ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                    />
                    {errors.recipientPhone?.message && (
                      <p id="recipientPhone-error" className="text-xs text-destructive mt-1">{errors.recipientPhone.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Pesan (Opsional)
                    </label>
                    <textarea
                      {...register("senderMessage")}
                      placeholder="Tulis pesan untuk penerima..."
                      rows={3}
                      className="w-full px-3 py-2 min-h-24 text-base border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Options */}
              <div className="animate-fade-slide-up animate-stagger-3 bg-card p-4 sm:p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
                  <Send size={20} aria-hidden="true" /> Opsi Pengiriman Voucher
                </h2>
                <div className="space-y-4 sm:space-y-5">
                  {/* Send To Toggle */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Kirim Voucher Ke
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {[
                        { value: SendTo.RECIPIENT, label: "Langsung ke Penerima" },
                        { value: SendTo.PURCHASER, label: "Kirim ke Saya" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center justify-center p-3 sm:p-4 border rounded-xl cursor-pointer transition-all text-sm sm:text-base min-h-12 sm:min-h-14 ${
                            sendTo === option.value
                              ? "border-primary bg-muted text-foreground font-medium"
                              : "border-border hover:border-muted-foreground text-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            value={option.value}
                            {...register("sendTo")}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>


                  {/* Delivery Method */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block font-medium">
                      Metode Pengiriman
                    </label>
                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { value: DeliveryMethod.WHATSAPP, label: "WhatsApp", icon: MessageCircle },
                        { value: DeliveryMethod.EMAIL, label: "Email", icon: Mail },
                        { value: DeliveryMethod.BOTH, label: "Email & WhatsApp", icon: Send },
                      ].map((method) => {
                        const isWhatsApp = method.value === DeliveryMethod.WHATSAPP;
                        const isSelected = deliveryMethod === method.value;
                        
                        return (
                          <label
                            key={method.value}
                            className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all min-h-12 sm:min-h-14 ${
                              isSelected
                                ? isWhatsApp
                                  ? "border-success bg-success/10 ring-2 ring-success/30"
                                  : "border-primary bg-muted"
                                : isWhatsApp
                                  ? "border-border hover:border-success/50 hover:bg-success/5"
                                  : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <input
                              type="radio"
                              value={method.value}
                              {...register("deliveryMethod")}
                              className="sr-only"
                            />
                            <method.icon
                              size={20}
                              className={
                                isSelected
                                  ? isWhatsApp ? "text-success" : "text-muted-foreground"
                                  : isWhatsApp ? "text-success/60" : "text-muted-foreground/50"
                              }
                            />
                            <span
                              className={
                                isSelected
                                  ? isWhatsApp ? "text-success font-semibold" : "text-foreground font-medium"
                                  : isWhatsApp ? "text-success/70 font-medium" : "text-muted-foreground"
                              }
                            >
                              {method.label}
                              {isWhatsApp && !isSelected && (
                                <span className="text-xs text-success/60 ml-1">(Disarankan)</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conditional Recipient Email Field */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      showRecipientEmail ? "opacity-100 max-h-48" : "opacity-0 max-h-0"
                    }`}
                    aria-hidden={!showRecipientEmail}
                  >
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block font-medium">
                        Email Penerima
                        {showRecipientEmail && <span className="text-destructive ml-1">*</span>}
                      </label>
                      <Input
                        {...register("recipientEmail", {
                          required: showRecipientEmail ? "Email wajib diisi untuk pengiriman email" : false,
                          pattern: showRecipientEmail
                            ? { value: /^\S+@\S+$/i, message: "Format email tidak valid" }
                            : undefined,
                        })}
                        type="email"
                        placeholder="recipient@email.com"
                        aria-invalid={!!errors.recipientEmail}
                        aria-describedby={errors.recipientEmail ? "recipientEmail-error" : undefined}
                        className={`min-h-12 text-base ${errors.recipientEmail ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                      />
                      {errors.recipientEmail?.message && (
                        <p id="recipientEmail-error" className="text-xs text-destructive mt-1">
                          {errors.recipientEmail.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Right Column - Order Summary */}
            <div className="lg:sticky lg:top-24 lg:h-fit">
              <div className="animate-scale-in bg-card p-4 sm:p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 text-lg">
                  Ringkasan Pesanan
                </h2>

                <div className="flex gap-3 sm:gap-4 mb-6">
                  <div className="relative size-16 sm:size-20 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={service.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"}
                      alt={service.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground text-sm sm:text-base line-clamp-2">{service.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {service.duration} menit
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-muted-foreground text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-sm">
                    <span>Biaya Layanan</span>
                    <span>Gratis</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-foreground">
                    <span>Total</span>
                    <span className="text-lg sm:text-xl">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing || isSnapLoading || !isSnapReady}
                  className="btn-hover-lift w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground py-3 sm:py-4 text-base sm:text-lg min-h-12 sm:min-h-14"
                  aria-busy={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Memproses...
                    </>
                  ) : isSnapLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Memuat...
                    </>
                  ) : (
                    "Bayar Sekarang"
                  )}
                </Button>

                <p className="text-center text-muted-foreground text-xs mt-4">
                  Pembayaran diproses secara aman oleh Midtrans
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

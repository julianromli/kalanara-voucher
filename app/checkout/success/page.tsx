"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { CheckCircle, Download, Mail, MessageCircle, AlertCircle, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { generateVoucherPDF, downloadPDF } from "@/lib/pdf";
import { generateWhatsAppUrl, WhatsAppVoucherData } from "@/lib/utils/whatsapp";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { getPublicOrderDetails } from "@/lib/actions/orders";

interface VoucherData {
  voucherCode: string;
  orderId: string;
  paymentOrderId: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientPhone: string;
  senderName: string;
  senderMessage?: string | null;
  serviceName: string;
  serviceDuration: number;
  amount: number;
  expiryDate: string;
  deliveryMethod: DeliveryMethod;
  sendTo: SendTo;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = searchParams.get("order_id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VoucherData | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Order ID tidak ditemukan");
      setIsLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        // Poll for voucher creation (webhook processing might take a moment)
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkStatus = async () => {
          try {
            const result = await getPublicOrderDetails(orderId);
            
            if (result && result.payment_status === "COMPLETED" && result.vouchers) {
              // Ensure vouchers is treated as a single object (since it's a 1:1 relation usually, but Supabase might return array if not single())
              // In OrderWithVoucher, vouchers is "Voucher | null" or similar.
              // We need to check if 'services' is nested in 'vouchers'
              const voucher = result.vouchers;
              // Get service details from voucher relation
              const service = voucher.services; 
              
              // Fallback: use result.services if voucher.services is missing (since Order also has service_id)
              // But createOrder saves service_id to Order.
              // Let's assume result.vouchers contains the code.
              
              if (!voucher) return false;

              // We need service details. 'result' has 'services' relation?
              // getPublicOrderDetails selects: `*, vouchers(*, services(*))`
              // This implies vouchers -> services. 
              // BUT 'orders' table also has 'service_id'. 
              // Let's use the top level fetch if possible, but getPublicOrderDetails definition was `*, vouchers(*, services(*))`
              // This means `result.vouchers.services` should be present.
              
              // However, the interface OrderWithVoucher might expect `services` at root too?
              // Let's check OrderWithVoucher in database.types.ts if I could.
              // Assuming safe access:

              setData({
                voucherCode: voucher.code,
                orderId: result.id,
                paymentOrderId: result.payment_order_id || "",
                recipientName: result.recipient_name || "",
                recipientEmail: result.recipient_email,
                recipientPhone: result.recipient_phone || "",
                senderName: result.customer_name || "",
                senderMessage: result.sender_message,
                serviceName: service?.name || "Layanan Spa",
                serviceDuration: service?.duration || 60,
                amount: result.total_amount,
                expiryDate: voucher.expiry_date,
                deliveryMethod: result.delivery_method as DeliveryMethod,
                sendTo: result.send_to as SendTo,
              });
              setIsLoading(false);
              return true;
            }
            
            return false;
          } catch (e) {
            console.error("Polling error:", e);
            return false;
          }
        };

        const poll = async () => {
          const success = await checkStatus();
          if (success) return;

          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000); // Retry every 2 seconds
          } else {
            setError("Pembayaran sedang diverifikasi. Silakan cek email/WhatsApp Anda dalam beberapa saat.");
            setIsLoading(false);
          }
        };

        poll();
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Terjadi kesalahan saat memuat data pesanan");
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleDownloadPDF = async () => {
    if (!data) return;
    try {
      const blob = await generateVoucherPDF({
        code: data.voucherCode,
        serviceName: data.serviceName,
        recipientName: data.recipientName,
        senderName: data.senderName,
        senderMessage: data.senderMessage || undefined,
        expiryDate: data.expiryDate,
      });
      downloadPDF(blob, `kalanara-voucher-${data.voucherCode}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      showToast("Gagal membuat PDF. Silakan coba lagi.", "error");
    }
  };

  const handleResendWhatsApp = () => {
    if (!data) return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const whatsappData: WhatsAppVoucherData = {
      recipientPhone: data.recipientPhone,
      recipientName: data.recipientName,
      senderName: data.senderName,
      senderMessage: data.senderMessage || "",
      voucherCode: data.voucherCode,
      serviceName: data.serviceName,
      serviceDuration: data.serviceDuration,
      amount: data.amount,
      expiryDate: data.expiryDate,
      verifyUrl: `${baseUrl}/verify?code=${data.voucherCode}`,
    };
    const whatsappUrl = generateWhatsAppUrl(whatsappData);
    window.open(whatsappUrl, "_blank");
  };

  const handleResendEmail = async () => {
    if (!data) return;
    if (!data.recipientEmail) {
      showToast("Email penerima tidak tersedia", "error");
      return;
    }

    try {
      const response = await fetch("/api/email/send-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          senderName: data.senderName,
          senderMessage: data.senderMessage,
          voucherCode: data.voucherCode,
          serviceName: data.serviceName,
          serviceDuration: data.serviceDuration,
          amount: data.amount,
          expiryDate: data.expiryDate,
        }),
      });

      if (!response.ok) throw new Error("Gagal mengirim email");
      
      showToast("Email berhasil dikirim ulang!", "success");
    } catch {
      showToast("Gagal mengirim email. Silakan coba lagi.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Memproses Pembayaran...</h2>
        <p className="text-muted-foreground text-center mt-2 max-w-md">
          Mohon tunggu sebentar, kami sedang memverifikasi pembayaran dan membuat voucher Anda.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Status Pesanan</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">{error}</p>
        <Button onClick={() => router.push("/")}>Kembali ke Beranda</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4 py-8">
      <div className="animate-scale-in bg-card rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 animate-checkmark-pop">
          <CheckCircle size={40} className="text-muted-foreground" />
        </div>
        
        <h1 className="font-sans font-semibold text-3xl text-foreground mb-2">
          Pembayaran Berhasil!
        </h1>
        <p className="text-muted-foreground mb-8">
          Voucher kamu sudah siap dan akan dikirim ke penerima.
        </p>

        <div className="bg-background p-6 rounded-2xl mb-6">
          <p className="text-sm text-muted-foreground mb-2">Order ID</p>
          <p className="font-mono text-lg text-foreground font-bold tracking-wider break-all">
            {data.paymentOrderId}
          </p>
        </div>

        <div className="bg-background p-6 rounded-2xl mb-6">
          <p className="text-sm text-muted-foreground mb-2">Kode Voucher</p>
          <p className="font-mono text-2xl text-foreground font-bold tracking-wider break-all">
            {data.voucherCode}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-card p-4 rounded-xl border border-border">
            <QRCode value={data.voucherCode} size={150} />
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
              disabled={!data.recipientEmail}
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

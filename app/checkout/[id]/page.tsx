"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Image from "next/image";
import {
  CreditCard,
  Building2,
  Wallet,
  Gift,
  User,
  CheckCircle,
  Mail,
  MessageCircle,
  Send,
  Phone,
  Download,
  ChevronLeft,
} from "lucide-react";
import QRCode from "react-qr-code";
import { generateVoucherPDF, downloadPDF } from "@/lib/pdf";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, APP_CONFIG } from "@/lib/constants";
import { PaymentMethod, PaymentStatus, DeliveryMethod, SendTo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVoucher } from "@/lib/actions/vouchers";
import { createOrder } from "@/lib/actions/orders";
import { generateWhatsAppUrl, WhatsAppVoucherData } from "@/lib/utils/whatsapp";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  senderMessage: string;
  paymentMethod: PaymentMethod;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
}

interface SuccessData {
  voucherCode: string;
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

export default function CheckoutPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { services, addVoucher, addOrder } = useStore();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const service = services.find((s) => s.id === id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      paymentMethod: PaymentMethod.CREDIT_CARD,
      sendTo: SendTo.RECIPIENT,
      deliveryMethod: DeliveryMethod.EMAIL,
    },
  });

  const selectedPayment = watch("paymentMethod");
  const sendTo = watch("sendTo");
  const deliveryMethod = watch("deliveryMethod");
  const needsRecipientPhone = deliveryMethod === DeliveryMethod.WHATSAPP || deliveryMethod === DeliveryMethod.BOTH;

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Service not found</p>
      </div>
    );
  }

  const onSubmit = async (data: CheckoutForm) => {
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + APP_CONFIG.voucherValidity);

      // Create voucher in Supabase
      const voucher = await createVoucher({
        service_id: service.id,
        recipient_name: data.recipientName,
        recipient_email: data.recipientEmail,
        sender_name: data.customerName,
        sender_message: data.senderMessage || null,
        expiry_date: expiryDate.toISOString(),
        amount: service.price,
      });

      if (!voucher) {
        throw new Error("Failed to create voucher");
      }

      // Create order in Supabase
      const order = await createOrder({
        voucher_id: voucher.id,
        customer_email: data.customerEmail,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        payment_method: data.paymentMethod,
        payment_status: PaymentStatus.COMPLETED,
        total_amount: service.price,
      });

      if (!order) {
        throw new Error("Failed to create order");
      }

      // Determine delivery target based on sendTo selection
      const targetEmail = data.sendTo === SendTo.PURCHASER ? data.customerEmail : data.recipientEmail;
      const targetPhone = data.sendTo === SendTo.PURCHASER ? data.customerPhone : data.recipientPhone;
      const targetName = data.sendTo === SendTo.PURCHASER ? data.customerName : data.recipientName;

      // Send voucher via email if selected
      if (data.deliveryMethod === DeliveryMethod.EMAIL || data.deliveryMethod === DeliveryMethod.BOTH) {
        try {
          await fetch("/api/email/send-voucher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientEmail: targetEmail,
              recipientName: targetName,
              senderName: data.customerName,
              senderMessage: data.senderMessage,
              voucherCode: voucher.code,
              serviceName: service.name,
              serviceDuration: service.duration,
              amount: service.price,
              expiryDate: expiryDate.toISOString(),
            }),
          });
        } catch (emailError) {
          console.error("Email sending failed:", emailError);
        }
      }

      // Generate WhatsApp URL if selected
      if (data.deliveryMethod === DeliveryMethod.WHATSAPP || data.deliveryMethod === DeliveryMethod.BOTH) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const whatsappData: WhatsAppVoucherData = {
          recipientPhone: targetPhone,
          recipientName: targetName,
          senderName: data.customerName,
          senderMessage: data.senderMessage,
          voucherCode: voucher.code,
          serviceName: service.name,
          serviceDuration: service.duration,
          amount: service.price,
          expiryDate: expiryDate.toISOString(),
          verifyUrl: `${baseUrl}/verify?code=${voucher.code}`,
        };
        const whatsappUrl = generateWhatsAppUrl(whatsappData);
        window.open(whatsappUrl, "_blank");
      }

      // Update local state
      addVoucher({
        id: voucher.id,
        code: voucher.code,
        service,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        senderName: data.customerName,
        senderMessage: data.senderMessage,
        purchaseDate: now,
        expiryDate,
        isRedeemed: false,
        amount: service.price,
      });

      // Store success data for resend options
      setSuccessData({
        voucherCode: voucher.code,
        recipientName: targetName,
        recipientEmail: targetEmail,
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

      const deliveryMsg = data.deliveryMethod === DeliveryMethod.BOTH 
        ? "via Email and WhatsApp" 
        : data.deliveryMethod === DeliveryMethod.WHATSAPP 
          ? "via WhatsApp" 
          : "via Email";
      showToast(`Payment successful! Voucher sent ${deliveryMsg}.`, "success");
    } catch (error) {
      console.error("Checkout error:", error);
      showToast("Failed to complete purchase. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

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
      showToast("Email resent successfully!", "success");
    } catch {
      showToast("Failed to send email. Please try again.", "error");
    }
  };

  const handleDownloadPDF = async () => {
    if (!successData || !service) return;
    try {
      const blob = await generateVoucherPDF({
        code: successData.voucherCode,
        serviceName: successData.serviceName,
        serviceDescription: service.description,
        duration: successData.serviceDuration,
        amount: successData.amount,
        recipientName: successData.recipientName,
        senderName: successData.senderName,
        senderMessage: successData.senderMessage || undefined,
        expiryDate: successData.expiryDate,
        purchaseDate: new Date().toISOString(),
      });
      downloadPDF(blob, `kalanara-voucher-${successData.voucherCode}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      showToast("Failed to generate PDF. Please try again.", "error");
    }
  };

  if (isSuccess && successData) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="bg-card rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-muted-foreground" />
          </div>
          <h1 className="font-sans font-semibold text-3xl text-foreground mb-2">
            Payment Successful!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your voucher has been created and sent to the recipient.
          </p>

          <div className="bg-background p-6 rounded-2xl mb-6">
            <p className="text-sm text-muted-foreground mb-2">Voucher Code</p>
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
            <p className="text-sm text-muted-foreground mb-3">Resend Voucher</p>
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

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
            >
              Back to Home
            </Button>
            <Button
              onClick={() => router.push("/verify")}
              variant="outline"
              className="w-full border-border text-muted-foreground py-3"
            >
              Verify Another Voucher
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-sans font-semibold text-3xl text-foreground mb-8 text-center">
          Complete Your Purchase
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Customer Details */}
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <User size={20} /> Your Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Full Name
                    </label>
                    <Input
                      {...register("customerName", { required: true })}
                      placeholder="Your name"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: true,
                        pattern: /^\S+@\S+$/i,
                      })}
                      type="email"
                      placeholder="your@email.com"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Phone
                    </label>
                    <Input
                      {...register("customerPhone", { required: true })}
                      placeholder="+62 xxx xxxx xxxx"
                      className={errors.customerPhone ? "border-destructive" : ""}
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Gift size={20} /> Recipient Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Recipient Name
                    </label>
                    <Input
                      {...register("recipientName", { required: true })}
                      placeholder="Voucher recipient's name"
                      className={errors.recipientName ? "border-destructive" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Recipient Email
                    </label>
                    <Input
                      {...register("recipientEmail", {
                        required: true,
                        pattern: /^\S+@\S+$/i,
                      })}
                      type="email"
                      placeholder="recipient@email.com"
                      className={errors.recipientEmail ? "border-destructive" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Message (Optional)
                    </label>
                    <textarea
                      {...register("senderMessage")}
                      placeholder="Write a personal message..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Options */}
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Send size={20} /> Voucher Delivery Options
                </h2>
                <div className="space-y-4">
                  {/* Send To Toggle */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Send Voucher To
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: SendTo.RECIPIENT, label: "Direct to Recipient" },
                        { value: SendTo.PURCHASER, label: "Send to Me" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all text-sm ${
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
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Delivery Method
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: DeliveryMethod.EMAIL, label: "Email", icon: Mail },
                        { value: DeliveryMethod.WHATSAPP, label: "WhatsApp", icon: MessageCircle },
                        { value: DeliveryMethod.BOTH, label: "Email & WhatsApp", icon: Send },
                      ].map((method) => (
                        <label
                          key={method.value}
                          className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                            deliveryMethod === method.value
                              ? "border-primary bg-muted"
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
                              deliveryMethod === method.value
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                            }
                          />
                          <span
                            className={
                              deliveryMethod === method.value
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {method.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Recipient Phone (conditional) */}
                  {needsRecipientPhone && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-2">
                        <Phone size={16} />
                        {sendTo === SendTo.PURCHASER ? "Your WhatsApp" : "Recipient's WhatsApp"}
                      </label>
                      <Input
                        {...register("recipientPhone", {
                          required: needsRecipientPhone,
                          pattern: /^[\d\s+()-]+$/,
                        })}
                        placeholder="+62 812 3456 7890"
                        className={errors.recipientPhone ? "border-destructive" : ""}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        WhatsApp number to receive the voucher
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CreditCard size={20} /> Payment Method
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      value: PaymentMethod.CREDIT_CARD,
                      label: "Credit/Debit Card",
                      icon: CreditCard,
                    },
                    {
                      value: PaymentMethod.BANK_TRANSFER,
                      label: "Bank Transfer",
                      icon: Building2,
                    },
                    {
                      value: PaymentMethod.E_WALLET,
                      label: "E-Wallet",
                      icon: Wallet,
                    },
                  ].map((method) => (
                    <label
                      key={method.value}
                      className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                        selectedPayment === method.value
                          ? "border-primary bg-muted"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <input
                        type="radio"
                        value={method.value}
                        {...register("paymentMethod")}
                        className="sr-only"
                      />
                      <method.icon
                        size={24}
                        className={
                          selectedPayment === method.value
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                        }
                      />
                      <span
                        className={
                          selectedPayment === method.value
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {method.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div>
              <div className="bg-card p-6 rounded-2xl border border-border sticky top-24">
                <h2 className="font-semibold text-foreground mb-4">
                  Order Summary
                </h2>

                <div className="flex gap-4 mb-6">
                  <div className="relative size-20 rounded-lg overflow-hidden">
                    <Image
                      src={service.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"}
                      alt={service.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {service.duration} minutes
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Fee</span>
                    <span>Free</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-foreground">
                    <span>Total</span>
                    <span className="text-xl">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-xl text-lg"
                >
                  {isProcessing ? "Processing..." : "Complete Purchase"}
                </Button>

                <p className="text-center text-muted-foreground text-xs mt-4">
                  By completing this purchase, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

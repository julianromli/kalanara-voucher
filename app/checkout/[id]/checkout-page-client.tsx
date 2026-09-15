"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type SubmitErrorHandler, useForm } from "react-hook-form";
import { ChevronLeft, Gift, Mail, MessageCircle, Send } from "lucide-react";
import { CustomerFields } from "@/components/checkout/customer-fields";
import { PaymentSelector } from "@/components/checkout/payment-selector";
import {
  MobileCheckoutCta,
  PricingSummary,
} from "@/components/checkout/pricing-summary";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { useCheckoutDiscount } from "@/hooks/use-checkout-discount";
import { usePaymentOptions } from "@/hooks/usePaymentOptions";
import { useScreenReaderAnnouncement } from "@/hooks/use-screen-reader-announcement";
import {
  buildCheckoutLineItem,
  buildConditionalFieldAnnouncement,
  getContactVisibility,
  getDeliveryPreview,
  normalizePhoneInput,
  PHONE_PATTERN,
} from "@/lib/checkout/client";
import {
  getPaymentStatusPath,
  POPUP_BLOCKED_MESSAGE,
  submitCheckoutPayment,
} from "@/lib/checkout/payment-client";
import type {
  ScalevCheckoutConfig,
  ScalevCheckoutRequest,
  ScalevVABankCode,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo, type Service } from "@/lib/types";

interface CheckoutPageClientProps {
  service: Service;
  initialPaymentConfig: ScalevCheckoutConfig;
}

interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderMessage: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
}

export function CheckoutPageClient({
  service,
  initialPaymentConfig,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { announcementRef, announce } = useScreenReaderAnnouncement();
  const [isProcessing, setIsProcessing] = useState(false);
  const payment = usePaymentOptions(initialPaymentConfig);
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
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      senderMessage: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
    },
    mode: "onBlur",
  });

  const sendTo = watch("sendTo");
  const deliveryMethod = watch("deliveryMethod");
  const customerEmail = watch("customerEmail");
  const customerPhone = watch("customerPhone");
  const { showRecipientPhone, showRecipientEmail } = getContactVisibility(
    sendTo,
    deliveryMethod
  );
  const discount = useCheckoutDiscount({
    customerEmail,
    customerPhone,
    serviceIds: [service.id],
    showToast,
  });

  useEffect(() => {
    clearErrors(["recipientPhone", "recipientEmail"]);
    announce(buildConditionalFieldAnnouncement(sendTo, deliveryMethod));
    void trigger(["recipientPhone", "recipientEmail"]);
  }, [announce, clearErrors, deliveryMethod, sendTo, trigger]);

  const registerPhone = (
    fieldName: "customerPhone" | "recipientPhone",
    required: string | false
  ) =>
    register(fieldName, {
      required,
      pattern: required
        ? {
            value: PHONE_PATTERN,
            message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx",
          }
        : undefined,
      setValueAs: (value: unknown) =>
        typeof value === "string" ? normalizePhoneInput(value) : value,
    });

  const onSubmit = async (data: CheckoutForm) => {
    if (!payment.paymentMethod) {
      showToast("Pilih metode pembayaran terlebih dahulu.", "error");
      return;
    }
    if (payment.paymentMethod === "va" && !payment.subPaymentMethod) {
      showToast("Pilih bank virtual account.", "error");
      return;
    }

    const lineItem = buildCheckoutLineItem({
      serviceId: service.id,
      ...data,
    });
    const request: ScalevCheckoutRequest = {
      ...lineItem,
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail.trim(),
      customerPhone: normalizePhoneInput(data.customerPhone),
      discountCode: discount.appliedDiscount?.code,
      paymentMethod: payment.paymentMethod,
      subPaymentMethod:
        payment.paymentMethod === "va"
          ? (payment.subPaymentMethod as ScalevVABankCode)
          : undefined,
    };

    setIsProcessing(true);
    try {
      const completed = await submitCheckoutPayment({
        request,
        onPopupBlocked: () => showToast(POPUP_BLOCKED_MESSAGE, "info"),
      });
      router.push(getPaymentStatusPath(completed));
    } catch (error) {
      console.error("Scalev checkout error:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Gagal memproses pembayaran. Silakan coba lagi.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const onInvalid: SubmitErrorHandler<CheckoutForm> = (submitErrors) => {
    const firstField = Object.keys(submitErrors)[0] as
      | keyof CheckoutForm
      | undefined;
    if (firstField) setFocus(firstField);
  };

  const summarySubtotal =
    discount.appliedDiscount?.subtotalAmount ?? service.price;
  const summaryTotal = discount.appliedDiscount?.totalAmount ?? service.price;
  const submitDisabled =
    isProcessing ||
    !payment.paymentMethod ||
    payment.isPaymentConfigLoading ||
    Boolean(payment.paymentError);

  return (
    <div className="min-h-screen bg-background pb-28 pt-8 md:pb-8">
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6 lg:px-8 animate-slide-in-left">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft
            size={20}
            className="transition-transform group-hover:-translate-x-1"
          />
          <span>Kembali</span>
        </button>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="animate-fade-slide-up font-sans text-2xl font-semibold text-foreground sm:text-3xl">
            Selesaikan Pembelian
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Isi data penerima, pilih cara kirim, lalu lanjut ke pembayaran.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="mt-8 space-y-8"
          aria-label="Form checkout voucher"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-6">
              <section className="animate-fade-slide-up animate-stagger-1 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Gift size={20} aria-hidden="true" /> Untuk siapa voucher ini?
                </h2>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-recipient-name"
                      className="mb-2 block text-sm font-medium text-muted-foreground"
                    >
                      Nama Penerima
                    </label>
                    <Input
                      id="checkout-recipient-name"
                      {...register("recipientName", {
                        required: "Nama penerima wajib diisi",
                      })}
                      placeholder="Nama penerima voucher"
                      className={errors.recipientName ? "border-destructive" : ""}
                      aria-invalid={Boolean(errors.recipientName)}
                      aria-describedby={[
                        "checkout-recipient-name-help",
                        errors.recipientName
                          ? "checkout-recipient-name-error"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <p
                      id="checkout-recipient-name-help"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      Nama ini akan tercetak di voucher.
                    </p>
                    {errors.recipientName ? (
                      <p
                        id="checkout-recipient-name-error"
                        className="mt-1 text-xs text-destructive"
                        role="alert"
                      >
                        {errors.recipientName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-sender-message"
                      className="mb-2 block text-sm font-medium text-muted-foreground"
                    >
                      Pesan untuk Penerima
                    </label>
                    <textarea
                      id="checkout-sender-message"
                      {...register("senderMessage")}
                      rows={3}
                      placeholder="Tulis pesan singkat jika mau"
                      className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-invalid={false}
                    />
                  </div>
                  <div>
                    <p className="mb-2 block text-sm font-medium text-muted-foreground">
                      Kirim Voucher Ke
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          value: SendTo.RECIPIENT,
                          label: "Langsung ke Penerima",
                        },
                        { value: SendTo.PURCHASER, label: "Kirim ke Saya" },
                      ].map((option) => {
                        const id = `checkout-send-to-${option.value}`;
                        return (
                          <label
                            key={option.value}
                            htmlFor={id}
                            className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-[color,background-color,border-color,box-shadow] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:text-base ${sendTo === option.value ? "border-primary bg-muted font-medium text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                          >
                            <input
                              id={id}
                              type="radio"
                              value={option.value}
                              {...register("sendTo", { required: true })}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
              <section className="animate-fade-slide-up animate-stagger-2 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Send size={20} aria-hidden="true" /> Cara kirim voucher
                </h2>
                <div className="space-y-5">
                  <div className="space-y-3">
                    {[
                      {
                        value: DeliveryMethod.WHATSAPP,
                        label: "WhatsApp",
                        icon: MessageCircle,
                      },
                      {
                        value: DeliveryMethod.EMAIL,
                        label: "Email",
                        icon: Mail,
                      },
                      {
                        value: DeliveryMethod.BOTH,
                        label: "Email & WhatsApp",
                        icon: Send,
                      },
                    ].map((method) => {
                      const id = `checkout-delivery-${method.value}`;
                      return (
                        <label
                          key={method.value}
                          htmlFor={id}
                          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-[background-color,border-color,box-shadow] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${deliveryMethod === method.value ? "border-primary bg-muted" : "border-border hover:border-muted-foreground"}`}
                        >
                          <input
                            id={id}
                            type="radio"
                            value={method.value}
                            {...register("deliveryMethod", { required: true })}
                            className="sr-only"
                          />
                          <method.icon
                            size={20}
                            className="text-muted-foreground"
                          />
                          <span className="text-sm text-foreground sm:text-base">
                            {method.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Delivery Preview
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {getDeliveryPreview(sendTo, deliveryMethod)}
                    </p>
                  </div>
                  {sendTo === SendTo.PURCHASER ? (
                    <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                      Voucher tetap memakai nama penerima di voucher, tetapi
                      pengiriman akan dikirim ke kontak kamu.
                    </div>
                  ) : null}
                  {showRecipientPhone ? (
                    <div>
                      <label
                        htmlFor="checkout-recipient-phone"
                        className="mb-2 block text-sm font-medium text-muted-foreground"
                      >
                        WhatsApp Penerima
                      </label>
                      <Input
                        id="checkout-recipient-phone"
                        {...registerPhone(
                          "recipientPhone",
                          "Nomor WhatsApp penerima wajib diisi"
                        )}
                        placeholder="+62 812 3456 7890"
                        className={
                          errors.recipientPhone ? "border-destructive" : ""
                        }
                        aria-invalid={Boolean(errors.recipientPhone)}
                        aria-describedby={[
                          "checkout-recipient-phone-help",
                          errors.recipientPhone
                            ? "checkout-recipient-phone-error"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      />
                      <p
                        id="checkout-recipient-phone-help"
                        className="mt-1 text-xs text-muted-foreground"
                      >
                        Gunakan format 08xxxxxxxx atau +62xxxxxxxx
                      </p>
                      {errors.recipientPhone ? (
                        <p
                          id="checkout-recipient-phone-error"
                          className="mt-1 text-xs text-destructive"
                          role="alert"
                        >
                          {errors.recipientPhone.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {showRecipientEmail ? (
                    <div>
                      <label
                        htmlFor="checkout-recipient-email"
                        className="mb-2 block text-sm font-medium text-muted-foreground"
                      >
                        Email Penerima
                      </label>
                      <Input
                        id="checkout-recipient-email"
                        {...register("recipientEmail", {
                          required: "Email penerima wajib diisi",
                          pattern: {
                            value: /^\S+@\S+$/i,
                            message: "Format email tidak valid",
                          },
                          setValueAs: (value: unknown) =>
                            typeof value === "string" ? value.trim() : value,
                        })}
                        type="email"
                        placeholder="penerima@email.com"
                        className={
                          errors.recipientEmail ? "border-destructive" : ""
                        }
                        aria-invalid={Boolean(errors.recipientEmail)}
                        aria-describedby={
                          errors.recipientEmail
                            ? "checkout-recipient-email-error"
                            : undefined
                        }
                      />
                      {errors.recipientEmail ? (
                        <p
                          id="checkout-recipient-email-error"
                          className="mt-1 text-xs text-destructive"
                          role="alert"
                        >
                          {errors.recipientEmail.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
              <CustomerFields
                idPrefix="checkout"
                className="animate-fade-slide-up animate-stagger-3"
                description="Kami gunakan untuk konfirmasi pembayaran dan bantuan jika ada kendala."
                nameRegistration={register("customerName", {
                  required: "Nama lengkap wajib diisi",
                  setValueAs: (value: unknown) =>
                    typeof value === "string" ? value.trim() : value,
                })}
                emailRegistration={register("customerEmail", {
                  required: "Email wajib diisi",
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: "Format email tidak valid",
                  },
                  setValueAs: (value: unknown) =>
                    typeof value === "string" ? value.trim() : value,
                })}
                phoneRegistration={registerPhone(
                  "customerPhone",
                  "Nomor WhatsApp wajib diisi"
                )}
                errors={{
                  name: errors.customerName,
                  email: errors.customerEmail,
                  phone: errors.customerPhone,
                }}
              />
              <PaymentSelector
                idPrefix="checkout"
                className="animate-fade-slide-up animate-stagger-4"
                paymentConfig={payment.paymentConfig}
                paymentError={payment.paymentError}
                paymentMethod={payment.paymentMethod}
                subPaymentMethod={payment.subPaymentMethod}
                paymentOptions={payment.paymentOptions}
                selectedPaymentOption={payment.selectedPaymentOption}
                isLoading={payment.isPaymentConfigLoading}
                onPaymentMethodChange={payment.setPaymentMethod}
                onSubPaymentMethodChange={payment.setSubPaymentMethod}
                onRetry={payment.retryPaymentOptions}
              />
            </div>
            <PricingSummary
              subtotal={summarySubtotal}
              total={summaryTotal}
              discount={discount}
              discountHint="Satu kode per checkout."
              isProcessing={isProcessing}
              isSubmitDisabled={submitDisabled}
            >
              <h2 className="text-lg font-semibold text-foreground">
                Ringkasan Pesanan
              </h2>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                1. Isi data 2. Bayar 3. Voucher dikirim
              </p>
              <div className="my-6 flex gap-4">
                <div className="relative size-20 overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={
                      service.image ||
                      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"
                    }
                    alt={service.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 font-medium text-foreground">
                    {service.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {service.duration} menit
                  </p>
                </div>
              </div>
            </PricingSummary>
          </div>
          <MobileCheckoutCta
            total={summaryTotal}
            isProcessing={isProcessing}
            disabled={submitDisabled}
          />
        </form>
      </div>
    </div>
  );
}

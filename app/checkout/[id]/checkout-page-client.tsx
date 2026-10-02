"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type SubmitErrorHandler, useForm } from "react-hook-form";
import { ChevronLeft, Gift } from "lucide-react";
import { CustomerFields } from "@/components/checkout/customer-fields";
import { PaymentSelector } from "@/components/checkout/payment-selector";
import { VoucherDeliveryFields } from "@/components/checkout/voucher-delivery-fields";
import {
  MobileCheckoutCta,
  PricingSummary,
} from "@/components/checkout/pricing-summary";
import { useToast } from "@/context/ToastContext";
import { useCheckoutDiscount } from "@/hooks/use-checkout-discount";
import { usePaymentOptions } from "@/hooks/usePaymentOptions";
import { useScreenReaderAnnouncement } from "@/hooks/use-screen-reader-announcement";
import {
  buildCheckoutLineItem,
  buildConditionalFieldAnnouncement,
  getContactVisibility,
  normalizePhoneInput,
  PHONE_PATTERN,
  resolveCheckoutRecipientName,
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
    clearErrors,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      sendTo: SendTo.PURCHASER,
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
  }, [announce, clearErrors, deliveryMethod, sendTo]);

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
    const payableTotal = discount.appliedDiscount?.totalAmount ?? service.price;
    const isComplimentary = payableTotal === 0;
    if (!isComplimentary && !payment.paymentMethod) {
      showToast("Pilih metode pembayaran terlebih dahulu.", "error");
      return;
    }
    if (
      !isComplimentary &&
      payment.paymentMethod === "va" &&
      !payment.subPaymentMethod
    ) {
      showToast("Pilih bank virtual account.", "error");
      return;
    }

    const lineItem = buildCheckoutLineItem({
      serviceId: service.id,
      ...data,
      recipientName: resolveCheckoutRecipientName(
        data.recipientName,
        data.customerName,
        data.sendTo
      ),
    });
    const request: ScalevCheckoutRequest = {
      ...lineItem,
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail.trim(),
      customerPhone: normalizePhoneInput(data.customerPhone),
      discountCode: discount.appliedDiscount?.code,
      paymentMethod: isComplimentary
        ? undefined
        : payment.paymentMethod ?? undefined,
      subPaymentMethod:
        !isComplimentary && payment.paymentMethod === "va"
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
  const isComplimentaryCheckout = summaryTotal === 0;
  const submitDisabled =
    isProcessing ||
    (!isComplimentaryCheckout &&
      (!payment.paymentMethod ||
        payment.isPaymentConfigLoading ||
        Boolean(payment.paymentError)));

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
            Isi data kamu, lalu lanjut ke pembayaran.
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
                  <Gift size={20} aria-hidden="true" /> Voucher
                </h2>
                <VoucherDeliveryFields
                  idPrefix="checkout"
                  sendTo={sendTo}
                  deliveryMethod={deliveryMethod}
                  senderMessage={watch("senderMessage")}
                  registerSendTo={() => register("sendTo", { required: true })}
                  recipientNameRegistration={register("recipientName", {
                    validate: (value) =>
                      sendTo === SendTo.RECIPIENT && !String(value ?? "").trim()
                        ? "Nama penerima wajib diisi"
                        : true,
                  })}
                  recipientNameError={errors.recipientName}
                  senderMessageRegistration={register("senderMessage")}
                  recipientPhoneRegistration={registerPhone(
                    "recipientPhone",
                    showRecipientPhone ? "Nomor WhatsApp penerima wajib diisi" : false
                  )}
                  recipientPhoneError={errors.recipientPhone}
                  recipientEmailRegistration={register("recipientEmail", {
                    required: showRecipientEmail ? "Email penerima wajib diisi" : false,
                    pattern: showRecipientEmail
                      ? {
                          value: /^\S+@\S+$/i,
                          message: "Format email tidak valid",
                        }
                      : undefined,
                    setValueAs: (value: unknown) =>
                      typeof value === "string" ? value.trim() : value,
                  })}
                  recipientEmailError={errors.recipientEmail}
                  showRecipientPhone={showRecipientPhone}
                  showRecipientEmail={showRecipientEmail}
                  onIncludeEmailChange={(includeEmail) =>
                    setValue(
                      "deliveryMethod",
                      includeEmail ? DeliveryMethod.BOTH : DeliveryMethod.WHATSAPP,
                      { shouldValidate: true }
                    )
                  }
                />
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
              {isComplimentaryCheckout ? null : (
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
              )}
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

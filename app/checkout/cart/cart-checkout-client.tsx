"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type SubmitErrorHandler } from "react-hook-form";
import { ChevronLeft, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { CustomerFields } from "@/components/checkout/customer-fields";
import { PaymentSelector } from "@/components/checkout/payment-selector";
import { MobileCheckoutCta, PricingSummary } from "@/components/checkout/pricing-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { useCheckoutDiscount } from "@/hooks/use-checkout-discount";
import { usePaymentOptions } from "@/hooks/usePaymentOptions";
import { useScreenReaderAnnouncement } from "@/hooks/use-screen-reader-announcement";
import { formatCurrency } from "@/lib/constants";
import { type ScalevCheckoutConfig, type ScalevCheckoutRequest, type ScalevVABankCode } from "@/lib/scalev/types";
import {
  buildCheckoutLineItem,
  getContactVisibility,
  getDeliveryMethodSummary,
  getSendToSummary,
  normalizePhoneInput,
  PHONE_PATTERN,
} from "@/lib/checkout/client";
import { getPaymentStatusPath, POPUP_BLOCKED_MESSAGE, submitCheckoutPayment } from "@/lib/checkout/payment-client";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { useCartStore } from "@/store/cart-store";

interface CartRecipientForm {
  cartItemId: string;
  serviceId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderMessage: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
}

interface CartCheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sameRecipient: boolean;
  lineItems: CartRecipientForm[];
}

interface CartCheckoutClientProps {
  initialPaymentConfig: ScalevCheckoutConfig;
}

export function CartCheckoutClient({ initialPaymentConfig }: CartCheckoutClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { announcementRef, announce: announceToScreenReader } = useScreenReaderAnnouncement();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const startPendingCheckout = useCartStore((state) => state.startPendingCheckout);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    paymentConfig,
    paymentError,
    paymentMethod,
    setPaymentMethod,
    subPaymentMethod,
    setSubPaymentMethod,
    paymentOptions,
    selectedPaymentOption,
    isPaymentConfigLoading,
    retryPaymentOptions,
  } = usePaymentOptions(initialPaymentConfig);
  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<CartCheckoutForm>({
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      sameRecipient: false,
      lineItems: [],
    },
    mode: "onBlur",
  });
  const { fields, replace } = useFieldArray({ control, name: "lineItems" });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const sameRecipient = watch("sameRecipient");
  const lineItems = watch("lineItems");
  const customerEmailValue = watch("customerEmail");
  const customerPhoneValue = watch("customerPhone");
  const primaryLineItem = lineItems?.[0];

  useEffect(() => {
    const currentLineItems = getValues("lineItems");
    replace(
      items.map((item) => {
        const existing = currentLineItems.find((lineItem) => lineItem.cartItemId === item.id);

        return {
          cartItemId: item.id,
          serviceId: item.service.id,
          recipientName: existing?.recipientName ?? "",
          recipientEmail: existing?.recipientEmail ?? "",
          recipientPhone: existing?.recipientPhone ?? "",
          senderMessage: existing?.senderMessage ?? "",
          sendTo: existing?.sendTo ?? SendTo.RECIPIENT,
          deliveryMethod: existing?.deliveryMethod ?? DeliveryMethod.WHATSAPP,
        };
      }),
    );
  }, [getValues, items, replace]);

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.service.price, 0), [items]);
  const discount = useCheckoutDiscount({
    customerEmail: customerEmailValue,
    customerPhone: customerPhoneValue,
    serviceIds: items.map((item) => item.service.id),
    resetKey: totalAmount,
    showToast,
  });

  useEffect(() => {
    if (!sameRecipient || !primaryLineItem) return;

    fields.slice(1).forEach((_, index) => {
      const itemIndex = index + 1;
      setValue(`lineItems.${itemIndex}.recipientName`, primaryLineItem.recipientName, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.recipientEmail`, primaryLineItem.recipientEmail, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.recipientPhone`, primaryLineItem.recipientPhone, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.senderMessage`, primaryLineItem.senderMessage);
      setValue(`lineItems.${itemIndex}.sendTo`, primaryLineItem.sendTo, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.deliveryMethod`, primaryLineItem.deliveryMethod, {
        shouldValidate: true,
      });
    });
  }, [
    fields,
    primaryLineItem,
    primaryLineItem?.deliveryMethod,
    primaryLineItem?.recipientEmail,
    primaryLineItem?.recipientName,
    primaryLineItem?.recipientPhone,
    primaryLineItem?.sendTo,
    primaryLineItem?.senderMessage,
    sameRecipient,
    setValue,
  ]);

  useEffect(() => {
    if (fields.length <= 1) return;

    announceToScreenReader(
      sameRecipient
        ? "Voucher kedua dan seterusnya sekarang mengikuti Voucher 1."
        : "Setiap voucher sekarang bisa diedit secara terpisah.",
    );
  }, [announceToScreenReader, fields.length, sameRecipient]);

  const registerPhoneField = useCallback(
    (fieldName: `customerPhone` | `lineItems.${number}.recipientPhone`, requiredMessage: string | false) =>
      register(fieldName, {
        required: requiredMessage,
        pattern: requiredMessage
          ? {
              value: PHONE_PATTERN,
              message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx",
            }
          : undefined,
        setValueAs: (value: unknown) => (typeof value === "string" ? normalizePhoneInput(value) : value),
      }),
    [register],
  );

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    showToast("Voucher dihapus dari keranjang.", "info");
  };

  const onSubmit = async (data: CartCheckoutForm) => {
    if (items.length === 0) {
      showToast("Keranjang masih kosong.", "error");
      return;
    }

    if (!paymentMethod) {
      showToast("Pilih metode pembayaran terlebih dahulu.", "error");
      return;
    }

    if (paymentMethod === "va" && !subPaymentMethod) {
      showToast("Pilih bank virtual account.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const requestBody: ScalevCheckoutRequest = {
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
        customerPhone: normalizePhoneInput(data.customerPhone),
        discountCode: discount.appliedDiscount?.code,
        paymentMethod,
        subPaymentMethod: paymentMethod === "va" ? (subPaymentMethod as ScalevVABankCode) : undefined,
        lineItems: data.lineItems.map(buildCheckoutLineItem),
      };
      const result = await submitCheckoutPayment({
        request: requestBody,
        onPopupBlocked: () => showToast(POPUP_BLOCKED_MESSAGE, "info"),
      });

      startPendingCheckout(
        result.paymentOrderId,
        data.lineItems.map((item) => item.cartItemId),
      );
      router.push(getPaymentStatusPath(result));
    } catch (error) {
      console.error("Cart checkout error:", error);
      showToast(error instanceof Error ? error.message : "Gagal memproses pembayaran. Silakan coba lagi.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const onInvalid: SubmitErrorHandler<CartCheckoutForm> = (submitErrors) => {
    if (submitErrors.customerName) {
      setFocus("customerName");
      return;
    }

    const lineItemErrors = submitErrors.lineItems;
    const firstLineItemIndex = Array.isArray(lineItemErrors)
      ? lineItemErrors.findIndex((lineItemError) => Boolean(lineItemError))
      : -1;
    if (firstLineItemIndex >= 0) {
      setFocus(`lineItems.${firstLineItemIndex}.recipientName`);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-spa">
          <ShoppingBag className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h1 className="font-sans text-2xl font-semibold text-foreground">Keranjang masih kosong</h1>
          <p className="mt-3 text-muted-foreground">Tambahkan voucher dari katalog sebelum melanjutkan checkout.</p>
          <Link href="/#services">
            <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">Pilih Voucher</Button>
          </Link>
        </div>
      </div>
    );
  }

  const summarySubtotal = discount.appliedDiscount?.subtotalAmount ?? totalAmount;
  const summaryTotal = discount.appliedDiscount?.totalAmount ?? totalAmount;
  const submitDisabled = isProcessing || !paymentMethod || isPaymentConfigLoading || Boolean(paymentError);

  return (
    <div className="min-h-screen bg-background pb-28 pt-8 md:pb-8">
      <div ref={announcementRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div className="mx-auto mb-6 max-w-6xl px-4 sm:px-6 lg:px-8 animate-slide-in-left">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          <span>Kembali</span>
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="animate-fade-slide-up font-sans text-2xl font-semibold text-foreground sm:text-3xl">
            Checkout Keranjang
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Atur penerima untuk setiap voucher, lalu lanjutkan pembayaran sekali.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="mt-8 space-y-8"
          aria-label="Form checkout keranjang voucher"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-6">
              <CustomerFields
                idPrefix="cart"
                nameRegistration={register("customerName", {
                  required: "Nama lengkap wajib diisi",
                  setValueAs: (value: unknown) => (typeof value === "string" ? value.trim() : value),
                })}
                emailRegistration={register("customerEmail", {
                  required: "Email wajib diisi",
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: "Format email tidak valid",
                  },
                  setValueAs: (value: unknown) => (typeof value === "string" ? value.trim() : value),
                })}
                phoneRegistration={registerPhoneField("customerPhone", "Nomor WhatsApp wajib diisi")}
                errors={{
                  name: errors.customerName,
                  email: errors.customerEmail,
                  phone: errors.customerPhone,
                }}
              />

              <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <ShoppingBag size={20} aria-hidden="true" /> Detail voucher
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Tiap item akan menjadi voucher terpisah.</p>
                  </div>
                  <label
                    htmlFor="cart-same-recipient"
                    className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-foreground"
                  >
                    <input id="cart-same-recipient" type="checkbox" {...register("sameRecipient")} />
                    Gunakan penerima yang sama
                  </label>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {sameRecipient
                    ? "Semua voucher di bawah mengikuti Voucher 1."
                    : "Aktifkan jika semua voucher ditujukan ke penerima yang sama."}
                </p>

                <div className="mt-6 space-y-5">
                  {fields.map((field, index) => {
                    const cartItem = items.find((item) => item.id === field.cartItemId);
                    const currentLineItem = lineItems?.[index];
                    if (!cartItem || !currentLineItem) {
                      return null;
                    }

                    const sendTo = currentLineItem.sendTo;
                    const deliveryMethod = currentLineItem?.deliveryMethod ?? DeliveryMethod.WHATSAPP;
                    const { showRecipientPhone, showRecipientEmail } = getContactVisibility(sendTo, deliveryMethod);
                    const itemErrors = errors.lineItems?.[index];

                    const isFollowingPrimary = sameRecipient && index > 0;
                    const fieldIdPrefix = `cart-voucher-${field.id}`;
                    const recipientNameId = `${fieldIdPrefix}-recipient-name`;
                    const senderMessageId = `${fieldIdPrefix}-sender-message`;
                    const recipientPhoneId = `${fieldIdPrefix}-recipient-phone`;
                    const recipientEmailId = `${fieldIdPrefix}-recipient-email`;

                    return (
                      <div
                        key={field.id}
                        className={`rounded-2xl border p-4 ${
                          isFollowingPrimary ? "border-border/80 bg-muted/35" : "border-border bg-background"
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {cartItem?.service.image ? (
                              <Image
                                src={cartItem.service.image}
                                alt={cartItem.service.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-foreground">{cartItem?.service.name ?? "Voucher"}</h3>
                              {sameRecipient && index === 0 ? (
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                  Data utama penerima
                                </span>
                              ) : null}
                              {isFollowingPrimary ? (
                                <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  Mengikuti Voucher 1
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{cartItem?.service.duration ?? 0} menit</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {formatCurrency(cartItem?.service.price ?? 0)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(field.cartItemId)}
                            aria-label="Hapus voucher dari keranjang"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <input type="hidden" {...register(`lineItems.${index}.cartItemId`)} />
                        <input type="hidden" {...register(`lineItems.${index}.serviceId`)} />

                        {isFollowingPrimary ? (
                          <div className="mt-5 space-y-3 rounded-xl border border-border/70 bg-background/80 p-4">
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                              <div>
                                <p className="text-muted-foreground">Nama Penerima</p>
                                <p className="font-medium text-foreground">
                                  {currentLineItem.recipientName || "Mengikuti Voucher 1"}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Kirim Voucher Ke</p>
                                <p className="font-medium text-foreground">{getSendToSummary(sendTo)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Cara Kirim</p>
                                <p className="font-medium text-foreground">
                                  {getDeliveryMethodSummary(deliveryMethod)}
                                </p>
                              </div>
                              {showRecipientPhone ? (
                                <div>
                                  <p className="text-muted-foreground">WhatsApp Penerima</p>
                                  <p className="font-medium text-foreground">{currentLineItem.recipientPhone || "-"}</p>
                                </div>
                              ) : null}
                              {showRecipientEmail ? (
                                <div>
                                  <p className="text-muted-foreground">Email Penerima</p>
                                  <p className="font-medium text-foreground">{currentLineItem.recipientEmail || "-"}</p>
                                </div>
                              ) : null}
                            </div>
                            {currentLineItem.senderMessage ? (
                              <div>
                                <p className="text-sm text-muted-foreground">Pesan untuk Penerima</p>
                                <p className="mt-1 text-sm text-foreground">{currentLineItem.senderMessage}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-5 grid gap-4">
                            <div>
                              <label
                                htmlFor={recipientNameId}
                                className="mb-2 block text-sm font-medium text-muted-foreground"
                              >
                                Nama Penerima
                              </label>
                              <Input
                                id={recipientNameId}
                                {...register(`lineItems.${index}.recipientName`, {
                                  required: "Nama penerima wajib diisi",
                                })}
                                placeholder="Nama penerima voucher"
                                className={itemErrors?.recipientName ? "border-destructive" : ""}
                                aria-invalid={Boolean(itemErrors?.recipientName)}
                                aria-describedby={itemErrors?.recipientName ? `${recipientNameId}-error` : undefined}
                              />
                              {itemErrors?.recipientName ? (
                                <p
                                  id={`${recipientNameId}-error`}
                                  className="mt-1 text-xs text-destructive"
                                  role="alert"
                                >
                                  {itemErrors.recipientName.message}
                                </p>
                              ) : null}
                            </div>

                            <div>
                              <label
                                htmlFor={senderMessageId}
                                className="mb-2 block text-sm font-medium text-muted-foreground"
                              >
                                Pesan untuk Penerima
                              </label>
                              <textarea
                                id={senderMessageId}
                                {...register(`lineItems.${index}.senderMessage`)}
                                rows={2}
                                placeholder="Tulis pesan singkat jika mau"
                                className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-invalid={false}
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="mb-2 text-sm font-medium text-muted-foreground">Kirim Voucher Ke</p>
                                <div className="grid gap-2">
                                  {[
                                    {
                                      value: SendTo.RECIPIENT,
                                      label: "Penerima",
                                    },
                                    { value: SendTo.PURCHASER, label: "Saya" },
                                  ].map((option) => {
                                    const radioId = `${fieldIdPrefix}-send-to-${option.value}`;

                                    return (
                                      <label
                                        key={option.value}
                                        htmlFor={radioId}
                                        className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-[color,background-color,border-color,box-shadow] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                                          sendTo === option.value
                                            ? "border-primary bg-muted font-medium text-foreground"
                                            : "border-border text-muted-foreground hover:border-muted-foreground"
                                        }`}
                                      >
                                        <input
                                          id={radioId}
                                          type="radio"
                                          value={option.value}
                                          {...register(`lineItems.${index}.sendTo`, {
                                            required: true,
                                          })}
                                          className="sr-only"
                                        />
                                        {option.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 text-sm font-medium text-muted-foreground">Cara kirim</p>
                                <div className="grid gap-2">
                                  {[
                                    {
                                      value: DeliveryMethod.WHATSAPP,
                                      label: "WhatsApp",
                                    },
                                    {
                                      value: DeliveryMethod.EMAIL,
                                      label: "Email",
                                    },
                                    {
                                      value: DeliveryMethod.BOTH,
                                      label: "Email & WhatsApp",
                                    },
                                  ].map((method) => {
                                    const radioId = `${fieldIdPrefix}-delivery-${method.value}`;

                                    return (
                                      <label
                                        key={method.value}
                                        htmlFor={radioId}
                                        className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-[color,background-color,border-color,box-shadow] focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                                          deliveryMethod === method.value
                                            ? "border-primary bg-muted font-medium text-foreground"
                                            : "border-border text-muted-foreground hover:border-muted-foreground"
                                        }`}
                                      >
                                        <input
                                          id={radioId}
                                          type="radio"
                                          value={method.value}
                                          {...register(`lineItems.${index}.deliveryMethod`, {
                                            required: true,
                                          })}
                                          className="sr-only"
                                        />
                                        {method.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {showRecipientPhone ? (
                              <div>
                                <label
                                  htmlFor={recipientPhoneId}
                                  className="mb-2 block text-sm font-medium text-muted-foreground"
                                >
                                  WhatsApp Penerima
                                </label>
                                <Input
                                  id={recipientPhoneId}
                                  {...registerPhoneField(
                                    `lineItems.${index}.recipientPhone`,
                                    "Nomor WhatsApp penerima wajib diisi",
                                  )}
                                  placeholder="+62 812 3456 7890"
                                  className={itemErrors?.recipientPhone ? "border-destructive" : ""}
                                  aria-invalid={Boolean(itemErrors?.recipientPhone)}
                                  aria-describedby={
                                    itemErrors?.recipientPhone ? `${recipientPhoneId}-error` : undefined
                                  }
                                />
                                {itemErrors?.recipientPhone ? (
                                  <p
                                    id={`${recipientPhoneId}-error`}
                                    className="mt-1 text-xs text-destructive"
                                    role="alert"
                                  >
                                    {itemErrors.recipientPhone.message}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {showRecipientEmail ? (
                              <div>
                                <label
                                  htmlFor={recipientEmailId}
                                  className="mb-2 block text-sm font-medium text-muted-foreground"
                                >
                                  Email Penerima
                                </label>
                                <Input
                                  id={recipientEmailId}
                                  {...register(`lineItems.${index}.recipientEmail`, {
                                    required: "Email penerima wajib diisi",
                                    pattern: {
                                      value: /^\S+@\S+$/i,
                                      message: "Format email tidak valid",
                                    },
                                    setValueAs: (value: unknown) => (typeof value === "string" ? value.trim() : value),
                                  })}
                                  type="email"
                                  placeholder="penerima@email.com"
                                  className={itemErrors?.recipientEmail ? "border-destructive" : ""}
                                  aria-invalid={Boolean(itemErrors?.recipientEmail)}
                                  aria-describedby={
                                    itemErrors?.recipientEmail ? `${recipientEmailId}-error` : undefined
                                  }
                                />
                                {itemErrors?.recipientEmail ? (
                                  <p
                                    id={`${recipientEmailId}-error`}
                                    className="mt-1 text-xs text-destructive"
                                    role="alert"
                                  >
                                    {itemErrors.recipientEmail.message}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <PaymentSelector
                idPrefix="cart"
                paymentConfig={paymentConfig}
                paymentError={paymentError}
                paymentMethod={paymentMethod}
                subPaymentMethod={subPaymentMethod}
                paymentOptions={paymentOptions}
                selectedPaymentOption={selectedPaymentOption}
                isLoading={isPaymentConfigLoading}
                onPaymentMethodChange={setPaymentMethod}
                onSubPaymentMethodChange={setSubPaymentMethod}
                onRetry={retryPaymentOptions}
              />
            </div>

            <PricingSummary
              subtotal={summarySubtotal}
              total={summaryTotal}
              discount={discount}
              discountHint="Berlaku untuk total checkout."
              isProcessing={isProcessing}
              isSubmitDisabled={submitDisabled}
            >
              <h2 className="text-lg font-semibold text-foreground">Ringkasan Pesanan</h2>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {items.length} voucher terpisah
              </p>
              <div className="my-6 space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <span className="line-clamp-2 text-muted-foreground">{item.service.name}</span>
                    <span className="font-medium text-foreground">{formatCurrency(item.service.price)}</span>
                  </div>
                ))}
              </div>
            </PricingSummary>
          </div>

          <MobileCheckoutCta total={summaryTotal} isProcessing={isProcessing} disabled={submitDisabled} />
        </form>
      </div>
    </div>
  );
}

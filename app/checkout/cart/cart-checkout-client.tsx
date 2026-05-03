"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type SubmitErrorHandler } from "react-hook-form";
import {
  AlertCircle,
  ChevronLeft,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import {
  type ScalevCheckoutConfig,
  type ScalevCheckoutRequest,
  type ScalevPaymentMethod,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import { isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";
import { DeliveryMethod, SendTo } from "@/lib/types";
import { useCartStore } from "@/store/cart-store";

const PHONE_PATTERN = /^(\+62|62|0)[\d\s-]{8,14}$/;

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

function normalizePhoneInput(value: string) {
  return value.replace(/[()-]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function getPaymentMethodDescription(code: ScalevPaymentMethod) {
  switch (code) {
    case "qris":
      return "Bayar dengan scan QRIS. Kode QR akan ditampilkan setelah pesanan dibuat.";
    case "va":
      return "Dapatkan nomor virtual account. Pilih bank setelah memilih metode ini.";
    case "invoice":
      return "Lanjut ke halaman pembayaran untuk menyelesaikan transaksi.";
    case "gopay":
    case "ovo":
    case "dana":
    case "shopeepay":
    case "linkaja":
      return "Kamu akan diarahkan ke halaman pembayaran / instruksi wallet.";
    default:
      return "Pembayaran diproses melalui Scalev.";
  }
}

function writePaymentLoadingShell(paymentWindow: Window | null) {
  const popupDocument = paymentWindow?.document;
  if (!popupDocument) return;

  popupDocument.open();
  popupDocument.write(`<!doctype html><html lang="id"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Menyiapkan pembayaran...</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1ea;color:#2f241d;font-family:ui-sans-serif,system-ui,sans-serif}.card{width:min(100%,420px);border-radius:24px;padding:32px;background:#fffaf4;border:1px solid rgba(124,92,67,.14);box-shadow:0 18px 50px rgba(47,36,29,.08)}.spinner{display:inline-block;width:18px;height:18px;border-radius:999px;border:2px solid rgba(124,92,67,.12);border-top-color:#7c5c43;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><main class="card"><p><span class="spinner"></span> Kalanara Spa</p><h1>Menyiapkan halaman pembayaran...</h1><p>Jangan tutup tab ini. Kami sedang mengarahkan kamu ke pembayaran.</p></main></body></html>`);
  popupDocument.close();
}

export function CartCheckoutClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<ScalevCheckoutConfig | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentConfigReloadKey, setPaymentConfigReloadKey] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<ScalevPaymentMethod | null>(null);
  const [subPaymentMethod, setSubPaymentMethod] = useState<ScalevVABankCode | "">("");

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

  useEffect(() => {
    const currentLineItems = getValues("lineItems");
    replace(
      items.map((item) => {
        const existing = currentLineItems.find(
          (lineItem) => lineItem.cartItemId === item.id
        );

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
      })
    );
  }, [getValues, items, replace]);

  const paymentOptions = useMemo(() => paymentConfig?.paymentOptions ?? [], [paymentConfig]);
  const selectedPaymentOption = useMemo(
    () => paymentOptions.find((option) => option.code === paymentMethod) ?? null,
    [paymentMethod, paymentOptions]
  );
  const isPaymentConfigLoading = !paymentConfig && !paymentError;
  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.service.price, 0),
    [items]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentOptions() {
      setPaymentError(null);
      try {
        const response = await fetch("/api/scalev/payment-options", { cache: "no-store" });
        const result = (await response.json()) as {
          success: boolean;
          config?: ScalevCheckoutConfig;
        };

        if (cancelled) return;
        if (!response.ok || !result.success || !result.config) {
          throw new Error("Gagal memuat metode pembayaran.");
        }

        setPaymentConfig(result.config);
        const nextMethod = result.config.paymentOptions[0]?.code ?? null;
        if (!nextMethod) {
          setPaymentError("Metode pembayaran sedang tidak tersedia.");
          return;
        }

        setPaymentMethod((current) =>
          current && result.config?.paymentOptions.some((option) => option.code === current)
            ? current
            : nextMethod
        );
      } catch (error) {
        console.error("Failed to load Scalev payment options:", error);
        if (!cancelled) {
          setPaymentConfig(null);
          setPaymentMethod(null);
          setSubPaymentMethod("");
          setPaymentError("Gagal memuat metode pembayaran. Coba muat ulang.");
        }
      }
    }

    void loadPaymentOptions();
    return () => {
      cancelled = true;
    };
  }, [paymentConfigReloadKey]);

  useEffect(() => {
    if (paymentMethod !== "va") {
      setSubPaymentMethod("");
      return;
    }

    if (
      selectedPaymentOption?.subMethods?.length &&
      !selectedPaymentOption.subMethods.includes(subPaymentMethod as ScalevVABankCode)
    ) {
      setSubPaymentMethod(selectedPaymentOption.subMethods[0]);
    }
  }, [paymentMethod, selectedPaymentOption, subPaymentMethod]);

  useEffect(() => {
    if (!sameRecipient || !lineItems?.[0]) return;

    const first = lineItems[0];
    lineItems.slice(1).forEach((_, index) => {
      const itemIndex = index + 1;
      setValue(`lineItems.${itemIndex}.recipientName`, first.recipientName, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.recipientEmail`, first.recipientEmail, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.recipientPhone`, first.recipientPhone, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.senderMessage`, first.senderMessage);
      setValue(`lineItems.${itemIndex}.sendTo`, first.sendTo, {
        shouldValidate: true,
      });
      setValue(`lineItems.${itemIndex}.deliveryMethod`, first.deliveryMethod, {
        shouldValidate: true,
      });
    });
  }, [lineItems, sameRecipient, setValue]);

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
        setValueAs: (value: unknown) =>
          typeof value === "string" ? normalizePhoneInput(value) : value,
      }),
    [register]
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
    const paymentWindow = window.open("", "_blank");
    writePaymentLoadingShell(paymentWindow);

    try {
      const requestBody: ScalevCheckoutRequest = {
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
        customerPhone: normalizePhoneInput(data.customerPhone),
        paymentMethod,
        subPaymentMethod:
          paymentMethod === "va" ? (subPaymentMethod as ScalevVABankCode) : undefined,
        lineItems: data.lineItems.map((item) => {
          const showRecipientPhone =
            item.sendTo === SendTo.RECIPIENT &&
            (item.deliveryMethod === DeliveryMethod.WHATSAPP ||
              item.deliveryMethod === DeliveryMethod.BOTH);
          const showRecipientEmail =
            item.sendTo === SendTo.RECIPIENT &&
            (item.deliveryMethod === DeliveryMethod.EMAIL ||
              item.deliveryMethod === DeliveryMethod.BOTH);

          return {
            serviceId: item.serviceId,
            recipientName: item.recipientName.trim(),
            recipientEmail: showRecipientEmail ? cleanOptionalText(item.recipientEmail) : undefined,
            recipientPhone: showRecipientPhone
              ? cleanOptionalText(normalizePhoneInput(item.recipientPhone ?? ""))
              : undefined,
            senderMessage: cleanOptionalText(item.senderMessage),
            deliveryMethod: item.deliveryMethod,
            sendTo: item.sendTo,
          };
        }),
      };

      const response = await fetch("/api/scalev/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result = (await response.json()) as {
        success: boolean;
        paymentLink?: string;
        paymentOrderId?: string;
        publicAccessToken?: string;
        error?: string;
      };

      if (
        !response.ok ||
        !result.success ||
        !result.paymentLink ||
        !result.paymentOrderId ||
        !result.publicAccessToken
      ) {
        throw new Error(result.error || "Gagal membuat pembayaran.");
      }

      const shouldOpenHostedPage = !isScalevHostedPublicOrderUrl(result.paymentLink);
      if (paymentWindow && shouldOpenHostedPage) {
        paymentWindow.location.href = result.paymentLink;
      } else if (paymentWindow) {
        paymentWindow.close();
      } else if (shouldOpenHostedPage) {
        showToast(
          "Popup pembayaran diblokir browser. Buka halaman pembayaran dari halaman status pembayaran.",
          "info"
        );
      }

      clearCart();
      router.push(
        `/checkout/success?order_id=${encodeURIComponent(result.paymentOrderId)}&token=${encodeURIComponent(result.publicAccessToken)}`
      );
    } catch (error) {
      console.error("Cart checkout error:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Gagal memproses pembayaran. Silakan coba lagi.",
        "error"
      );
      paymentWindow?.close();
    } finally {
      setIsProcessing(false);
    }
  };

  const onInvalid: SubmitErrorHandler<CartCheckoutForm> = (submitErrors) => {
    if (submitErrors.customerName) {
      setFocus("customerName");
      return;
    }

    const firstLineItemIndex = submitErrors.lineItems?.findIndex(Boolean);
    if (typeof firstLineItemIndex === "number" && firstLineItemIndex >= 0) {
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
          <h1 className="font-sans text-2xl font-semibold text-foreground">
            Keranjang masih kosong
          </h1>
          <p className="mt-3 text-muted-foreground">
            Tambahkan voucher dari katalog sebelum melanjutkan checkout.
          </p>
          <Link href="/#services">
            <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
              Pilih Voucher
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 pt-8 md:pb-8">
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
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <User size={20} aria-hidden="true" /> Data pembeli
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Lengkap
                    </label>
                    <Input
                      {...register("customerName", {
                        required: "Nama lengkap wajib diisi",
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      placeholder="Nama kamu"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                    {errors.customerName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: "Email wajib diisi",
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: "Format email tidak valid",
                        },
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      type="email"
                      placeholder="nama@email.com"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                    {errors.customerEmail ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerEmail.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      WhatsApp
                    </label>
                    <Input
                      {...registerPhoneField("customerPhone", "Nomor WhatsApp wajib diisi")}
                      placeholder="+62 812 3456 7890"
                      className={errors.customerPhone ? "border-destructive" : ""}
                    />
                    {errors.customerPhone ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerPhone.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <ShoppingBag size={20} aria-hidden="true" /> Detail voucher
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tiap item akan menjadi voucher terpisah.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-foreground">
                    <input type="checkbox" {...register("sameRecipient")} />
                    Same recipient
                  </label>
                </div>

                <div className="mt-6 space-y-5">
                  {fields.map((field, index) => {
                    const cartItem = items.find((item) => item.id === field.cartItemId);
                    const currentLineItem = lineItems?.[index];
                    if (!cartItem || !currentLineItem) {
                      return null;
                    }

                    const sendTo = currentLineItem.sendTo;
                    const deliveryMethod =
                      currentLineItem?.deliveryMethod ?? DeliveryMethod.WHATSAPP;
                    const showRecipientPhone =
                      sendTo === SendTo.RECIPIENT &&
                      (deliveryMethod === DeliveryMethod.WHATSAPP ||
                        deliveryMethod === DeliveryMethod.BOTH);
                    const showRecipientEmail =
                      sendTo === SendTo.RECIPIENT &&
                      (deliveryMethod === DeliveryMethod.EMAIL ||
                        deliveryMethod === DeliveryMethod.BOTH);
                    const itemErrors = errors.lineItems?.[index];

                    return (
                      <div
                        key={field.id}
                        className="rounded-2xl border border-border bg-background p-4"
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
                            <h3 className="font-medium text-foreground">
                              {cartItem?.service.name ?? "Voucher"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {cartItem?.service.duration ?? 0} menit
                            </p>
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

                        <input
                          type="hidden"
                          {...register(`lineItems.${index}.cartItemId`)}
                        />
                        <input
                          type="hidden"
                          {...register(`lineItems.${index}.serviceId`)}
                        />

                        <div className="mt-5 grid gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-muted-foreground">
                              Nama Penerima
                            </label>
                            <Input
                              {...register(`lineItems.${index}.recipientName`, {
                                required: "Nama penerima wajib diisi",
                              })}
                              placeholder="Nama penerima voucher"
                              className={itemErrors?.recipientName ? "border-destructive" : ""}
                            />
                            {itemErrors?.recipientName ? (
                              <p className="mt-1 text-xs text-destructive" role="alert">
                                {itemErrors.recipientName.message}
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-muted-foreground">
                              Pesan untuk Penerima
                            </label>
                            <textarea
                              {...register(`lineItems.${index}.senderMessage`)}
                              rows={2}
                              placeholder="Tulis pesan singkat jika mau"
                              className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-2 text-sm font-medium text-muted-foreground">
                                Kirim Voucher Ke
                              </p>
                              <div className="grid gap-2">
                                {[
                                  { value: SendTo.RECIPIENT, label: "Penerima" },
                                  { value: SendTo.PURCHASER, label: "Saya" },
                                ].map((option) => (
                                  <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-all ${
                                      sendTo === option.value
                                        ? "border-primary bg-muted font-medium text-foreground"
                                        : "border-border text-muted-foreground hover:border-muted-foreground"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      value={option.value}
                                      {...register(`lineItems.${index}.sendTo`, { required: true })}
                                      className="sr-only"
                                    />
                                    {option.label}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-sm font-medium text-muted-foreground">
                                Cara kirim
                              </p>
                              <div className="grid gap-2">
                                {[
                                  { value: DeliveryMethod.WHATSAPP, label: "WhatsApp" },
                                  { value: DeliveryMethod.EMAIL, label: "Email" },
                                  { value: DeliveryMethod.BOTH, label: "Email & WhatsApp" },
                                ].map((method) => (
                                  <label
                                    key={method.value}
                                    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-all ${
                                      deliveryMethod === method.value
                                        ? "border-primary bg-muted font-medium text-foreground"
                                        : "border-border text-muted-foreground hover:border-muted-foreground"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      value={method.value}
                                      {...register(`lineItems.${index}.deliveryMethod`, {
                                        required: true,
                                      })}
                                      className="sr-only"
                                    />
                                    {method.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          {showRecipientPhone ? (
                            <div>
                              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                WhatsApp Penerima
                              </label>
                              <Input
                                {...registerPhoneField(
                                  `lineItems.${index}.recipientPhone`,
                                  "Nomor WhatsApp penerima wajib diisi"
                                )}
                                placeholder="+62 812 3456 7890"
                                className={itemErrors?.recipientPhone ? "border-destructive" : ""}
                              />
                              {itemErrors?.recipientPhone ? (
                                <p className="mt-1 text-xs text-destructive" role="alert">
                                  {itemErrors.recipientPhone.message}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {showRecipientEmail ? (
                            <div>
                              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                                Email Penerima
                              </label>
                              <Input
                                {...register(`lineItems.${index}.recipientEmail`, {
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
                                className={itemErrors?.recipientEmail ? "border-destructive" : ""}
                              />
                              {itemErrors?.recipientEmail ? (
                                <p className="mt-1 text-xs text-destructive" role="alert">
                                  {itemErrors.recipientEmail.message}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <CreditCard size={20} aria-hidden="true" /> Metode pembayaran
                </h2>

                {paymentConfig?.paymentNotice ? (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {paymentConfig.paymentNotice}
                  </div>
                ) : null}

                {isPaymentConfigLoading ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <p className="text-sm text-muted-foreground">
                        Sedang menyiapkan metode pembayaran...
                      </p>
                    </div>
                  </div>
                ) : paymentError ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-5 text-destructive" />
                      <div>
                        <p className="font-medium text-foreground">
                          Metode pembayaran belum berhasil dimuat
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{paymentError}</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          onClick={() => setPaymentConfigReloadKey((value) => value + 1)}
                        >
                          Coba Muat Ulang
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paymentOptions.map((option) => (
                        <label
                          key={option.code}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                            paymentMethod === option.code
                              ? "border-primary bg-muted"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={option.code}
                            checked={paymentMethod === option.code}
                            onChange={() => setPaymentMethod(option.code)}
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{option.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {getPaymentMethodDescription(option.code)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {paymentMethod === "va" && selectedPaymentOption?.subMethods?.length ? (
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                          Bank Virtual Account
                        </label>
                        <select
                          value={subPaymentMethod}
                          onChange={(event) =>
                            setSubPaymentMethod(event.target.value as ScalevVABankCode)
                          }
                          className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"
                        >
                          {selectedPaymentOption.subMethods.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-foreground">Ringkasan Pesanan</h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {items.length} voucher terpisah
                </p>
                <div className="my-6 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-sm">
                      <span className="line-clamp-2 text-muted-foreground">{item.service.name}</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.service.price)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Biaya Layanan</span>
                    <span>Gratis</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3 font-semibold text-foreground">
                    <span>Total</span>
                    <span className="text-lg">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isProcessing || !paymentMethod || isPaymentConfigLoading || Boolean(paymentError)}
                  className="btn-hover-lift mt-6 hidden min-h-14 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90 md:flex"
                  aria-busy={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Lanjut ke Pembayaran"
                  )}
                </Button>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Pembayaran diproses aman melalui Scalev.
                </p>
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Total
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <Button
                type="submit"
                disabled={isProcessing || !paymentMethod || isPaymentConfigLoading || Boolean(paymentError)}
                className="min-h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                aria-busy={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Lanjut ke Pembayaran"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

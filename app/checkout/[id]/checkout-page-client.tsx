"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type SubmitErrorHandler, useForm } from "react-hook-form";
import {
  ChevronLeft,
  CreditCard,
  Gift,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/constants";
import {
  type ScalevCheckoutConfig,
  type ScalevCheckoutRequest,
  type ScalevPaymentMethod,
  type ScalevVABankCode,
} from "@/lib/scalev/types";
import { DeliveryMethod, SendTo, type Service } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

const PHONE_PATTERN = /^(\+62|62|0)[\d\s-]{8,14}$/;

interface CheckoutPageClientProps {
  service: Service;
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

export function CheckoutPageClient({ service }: CheckoutPageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const announcementRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<ScalevCheckoutConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ScalevPaymentMethod | null>(null);
  const [subPaymentMethod, setSubPaymentMethod] = useState<ScalevVABankCode | "">("");

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
  const recipientEmail = watch("recipientEmail");

  const showRecipientEmail =
    (deliveryMethod === DeliveryMethod.EMAIL ||
      deliveryMethod === DeliveryMethod.BOTH) &&
    sendTo === SendTo.RECIPIENT;

  const selectedPaymentOption = useMemo(
    () =>
      paymentConfig?.paymentOptions.find((option) => option.code === paymentMethod) ||
      null,
    [paymentConfig, paymentMethod]
  );

  const announceToScreenReader = (message: string) => {
    if (!announcementRef.current) return;
    announcementRef.current.textContent = message;
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = "";
      }
    }, 1000);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentOptions() {
      try {
        const response = await fetch("/api/scalev/payment-options", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          success: boolean;
          config?: ScalevCheckoutConfig;
        };

        if (!cancelled && result.success && result.config) {
          setPaymentConfig(result.config);
          const firstAvailableMethod = result.config.paymentOptions[0]?.code || null;

          if (!firstAvailableMethod) {
            showToast("Metode pembayaran sedang tidak tersedia.", "error");
            return;
          }

          setPaymentMethod(firstAvailableMethod);
          if (firstAvailableMethod !== "va") {
            setSubPaymentMethod("");
          }
        }
      } catch (error) {
        console.error("Failed to load Scalev payment options:", error);
        if (!cancelled) {
          showToast("Gagal memuat metode pembayaran.", "error");
        }
      }
    }

    void loadPaymentOptions();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (showRecipientEmail) {
      void trigger("recipientEmail");
      announceToScreenReader(
        "Email penerima sekarang wajib diisi untuk metode pengiriman yang dipilih."
      );
    } else {
      clearErrors("recipientEmail");
      announceToScreenReader("Email penerima tidak lagi wajib diisi.");
    }
  }, [clearErrors, showRecipientEmail, trigger]);

  useEffect(() => {
    if (showRecipientEmail && recipientEmail && errors.recipientEmail) {
      void trigger("recipientEmail");
    }
  }, [errors.recipientEmail, recipientEmail, showRecipientEmail, trigger]);

  useEffect(() => {
    if (paymentMethod !== "va") {
      setSubPaymentMethod("");
    } else if (
      selectedPaymentOption?.subMethods?.length &&
      !selectedPaymentOption.subMethods.includes(subPaymentMethod as ScalevVABankCode)
    ) {
      setSubPaymentMethod(selectedPaymentOption.subMethods[0]);
    }
  }, [paymentMethod, selectedPaymentOption, subPaymentMethod]);

  const onSubmit = async (data: CheckoutForm) => {
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

    try {
      const requestBody: ScalevCheckoutRequest = {
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
        paymentMethod,
        subPaymentMethod:
          paymentMethod === "va" ? (subPaymentMethod as ScalevVABankCode) : undefined,
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

      if (paymentWindow) {
        paymentWindow.location.href = result.paymentLink;
      } else {
        showToast(
          "Popup pembayaran diblokir browser. Buka halaman pembayaran dari tombol di halaman berikutnya.",
          "info"
        );
      }

      router.push(
        `/checkout/success?order_id=${encodeURIComponent(result.paymentOrderId)}&token=${encodeURIComponent(result.publicAccessToken)}`
      );
    } catch (error) {
      console.error("Scalev checkout error:", error);
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

  const onInvalid: SubmitErrorHandler<CheckoutForm> = (submitErrors) => {
    const firstField = Object.keys(submitErrors)[0] as keyof CheckoutForm | undefined;
    if (firstField) {
      setFocus(firstField);
    }
  };

  if (!paymentConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div className="mx-auto mb-6 max-w-4xl px-4 animate-slide-in-left">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          <span>Kembali</span>
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="animate-fade-slide-up text-center font-sans text-2xl font-semibold text-foreground sm:text-3xl">
          Selesaikan Pembelian
        </h1>

        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="mt-8 space-y-8"
          aria-label="Form checkout voucher"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="animate-fade-slide-up animate-stagger-1 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <User size={20} aria-hidden="true" /> Data Kamu
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Lengkap
                    </label>
                    <Input
                      {...register("customerName", { required: "Nama lengkap wajib diisi" })}
                      placeholder="Nama kamu"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                    {errors.customerName ? (
                      <p className="mt-1 text-xs text-destructive">
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
                      })}
                      type="email"
                      placeholder="nama@email.com"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                    {errors.customerEmail ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.customerEmail.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
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
                      className={errors.customerPhone ? "border-destructive" : ""}
                    />
                    {errors.customerPhone ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.customerPhone.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="animate-fade-slide-up animate-stagger-2 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Gift size={20} aria-hidden="true" /> Data Penerima
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Penerima
                    </label>
                    <Input
                      {...register("recipientName", { required: "Nama penerima wajib diisi" })}
                      placeholder="Nama penerima voucher"
                      className={errors.recipientName ? "border-destructive" : ""}
                    />
                    {errors.recipientName ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.recipientName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
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
                      className={errors.recipientPhone ? "border-destructive" : ""}
                    />
                    {errors.recipientPhone ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.recipientPhone.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Pesan
                    </label>
                    <textarea
                      {...register("senderMessage")}
                      rows={3}
                      placeholder="Tulis pesan untuk penerima..."
                      className="min-h-24 w-full resize-none rounded-lg border border-border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              <div className="animate-fade-slide-up animate-stagger-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Send size={20} aria-hidden="true" /> Opsi Pengiriman Voucher
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Kirim Voucher Ke
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: SendTo.RECIPIENT, label: "Langsung ke Penerima" },
                        { value: SendTo.PURCHASER, label: "Kirim ke Saya" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border p-3 text-sm transition-all sm:text-base ${
                            sendTo === option.value
                              ? "border-primary bg-muted font-medium text-foreground"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
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

                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Metode Pengiriman
                    </label>
                    <div className="space-y-3">
                      {[
                        { value: DeliveryMethod.WHATSAPP, label: "WhatsApp", icon: MessageCircle },
                        { value: DeliveryMethod.EMAIL, label: "Email", icon: Mail },
                        { value: DeliveryMethod.BOTH, label: "Email & WhatsApp", icon: Send },
                      ].map((method) => (
                        <label
                          key={method.value}
                          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
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
                          <method.icon size={20} className="text-muted-foreground" />
                          <span className="text-sm text-foreground sm:text-base">
                            {method.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      showRecipientEmail ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    }`}
                    aria-hidden={!showRecipientEmail}
                  >
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email Penerima
                    </label>
                    <Input
                      {...register("recipientEmail", {
                        required: showRecipientEmail
                          ? "Email wajib diisi untuk pengiriman email"
                          : false,
                        pattern: showRecipientEmail
                          ? {
                              value: /^\S+@\S+$/i,
                              message: "Format email tidak valid",
                            }
                          : undefined,
                      })}
                      type="email"
                      placeholder="penerima@email.com"
                      className={errors.recipientEmail ? "border-destructive" : ""}
                    />
                    {errors.recipientEmail ? (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.recipientEmail.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="animate-fade-slide-up animate-stagger-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <CreditCard size={20} aria-hidden="true" /> Metode Pembayaran
                </h2>
                {paymentConfig.paymentNotice ? (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {paymentConfig.paymentNotice}
                  </div>
                ) : null}
                <div className="space-y-3">
                  {paymentConfig.paymentOptions.map((option) => (
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
                        {option.code === "va" && option.subMethods?.length ? (
                          <p className="text-sm text-muted-foreground">
                            Pilih bank virtual account pada dropdown di bawah.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Pembayaran diproses melalui Scalev.
                          </p>
                        )}
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
              </div>
            </div>

            <div className="lg:sticky lg:top-24 lg:h-fit">
              <div className="animate-scale-in rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Ringkasan Pesanan
                </h2>

                <div className="mb-6 flex gap-4">
                  <div className="relative size-20 overflow-hidden rounded-lg">
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

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Biaya Layanan</span>
                    <span>Gratis</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3 font-semibold text-foreground">
                    <span>Total</span>
                    <span className="text-lg">{formatCurrency(service.price)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing || !paymentMethod}
                  className="btn-hover-lift mt-6 min-h-14 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
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
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type SubmitErrorHandler, useForm } from "react-hook-form";
import {
  AlertCircle,
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
import { DeliveryMethod, SendTo, type Service } from "@/lib/types";

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
  recipientPhone?: string;
  senderMessage: string;
  sendTo: SendTo;
  deliveryMethod: DeliveryMethod;
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

function getDeliveryPreview(sendTo: SendTo, deliveryMethod: DeliveryMethod) {
  if (sendTo === SendTo.RECIPIENT) {
    switch (deliveryMethod) {
      case DeliveryMethod.WHATSAPP:
        return "Voucher akan dikirim ke WhatsApp penerima setelah pembayaran berhasil.";
      case DeliveryMethod.EMAIL:
        return "Voucher akan dikirim ke email penerima setelah pembayaran berhasil.";
      case DeliveryMethod.BOTH:
        return "Voucher akan dikirim ke email dan WhatsApp penerima setelah pembayaran berhasil.";
    }
  }

  switch (deliveryMethod) {
    case DeliveryMethod.WHATSAPP:
      return "Voucher akan dikirim ke WhatsApp kamu setelah pembayaran berhasil.";
    case DeliveryMethod.EMAIL:
      return "Voucher akan dikirim ke email kamu setelah pembayaran berhasil.";
    case DeliveryMethod.BOTH:
      return "Voucher akan dikirim ke email dan WhatsApp kamu setelah pembayaran berhasil.";
  }
}

function buildConditionalFieldAnnouncement(
  sendTo: SendTo,
  deliveryMethod: DeliveryMethod
) {
  if (sendTo === SendTo.PURCHASER) {
    return "Kontak penerima disembunyikan. Voucher akan dikirim ke kontak kamu.";
  }

  if (deliveryMethod === DeliveryMethod.WHATSAPP) {
    return "Field WhatsApp penerima wajib diisi.";
  }

  if (deliveryMethod === DeliveryMethod.EMAIL) {
    return "Field email penerima wajib diisi.";
  }

  return "Field email dan WhatsApp penerima wajib diisi.";
}

function writePaymentLoadingShell(paymentWindow: Window | null) {
  const popupDocument = paymentWindow?.document;
  if (!popupDocument) {
    return;
  }

  popupDocument.open();
  popupDocument.write(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Menyiapkan halaman pembayaran…</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f1ea;
        --card: #fffaf4;
        --text: #2f241d;
        --muted: #78685d;
        --accent: #7c5c43;
        --accent-soft: rgba(124, 92, 67, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top, rgba(124, 92, 67, 0.14), transparent 40%),
          linear-gradient(180deg, #fcf8f2 0%, var(--bg) 100%);
        color: var(--text);
      }
      .card {
        width: min(100%, 420px);
        border-radius: 24px;
        padding: 32px;
        background: var(--card);
        border: 1px solid rgba(124, 92, 67, 0.14);
        box-shadow: 0 18px 50px rgba(47, 36, 29, 0.08);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
      }
      .spinner {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid var(--accent-soft);
        border-top-color: var(--accent);
        animation: spin 0.8s linear infinite;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: 28px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: var(--muted);
      }
      .hint {
        margin-top: 18px;
        font-size: 14px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge"><span class="spinner"></span>Kalanara Spa</div>
      <h1>Menyiapkan halaman pembayaran…</h1>
      <p>Jangan tutup tab ini. Kami sedang mengarahkan kamu ke pembayaran.</p>
      <p class="hint">Jika tidak terbuka otomatis, kembali ke halaman status pembayaran.</p>
    </main>
  </body>
</html>`);
  popupDocument.close();
}

export function CheckoutPageClient({ service }: CheckoutPageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const announcementRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<ScalevCheckoutConfig | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentConfigReloadKey, setPaymentConfigReloadKey] = useState(0);
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
  const showRecipientPhone =
    sendTo === SendTo.RECIPIENT &&
    (deliveryMethod === DeliveryMethod.WHATSAPP || deliveryMethod === DeliveryMethod.BOTH);
  const showRecipientEmail =
    sendTo === SendTo.RECIPIENT &&
    (deliveryMethod === DeliveryMethod.EMAIL || deliveryMethod === DeliveryMethod.BOTH);
  const paymentOptions = useMemo(
    () => paymentConfig?.paymentOptions ?? [],
    [paymentConfig]
  );
  const isPaymentConfigLoading = !paymentConfig && !paymentError;

  const selectedPaymentOption = useMemo(
    () => paymentOptions.find((option) => option.code === paymentMethod) ?? null,
    [paymentMethod, paymentOptions]
  );

  const announceToScreenReader = useCallback((message: string) => {
    if (!announcementRef.current) return;
    announcementRef.current.textContent = message;
    window.setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = "";
      }
    }, 1000);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentOptions() {
      setPaymentError(null);

      try {
        const response = await fetch("/api/scalev/payment-options", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          success: boolean;
          config?: ScalevCheckoutConfig;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !result.success || !result.config) {
          throw new Error("Gagal memuat metode pembayaran.");
        }

        setPaymentConfig(result.config);
        const nextMethod = result.config.paymentOptions[0]?.code ?? null;

        if (!nextMethod) {
          setPaymentError("Metode pembayaran sedang tidak tersedia.");
          return;
        }

        setPaymentMethod((current) => {
          if (current && result.config?.paymentOptions.some((option) => option.code === current)) {
            return current;
          }

          return nextMethod;
        });
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
    clearErrors(["recipientPhone", "recipientEmail"]);
    announceToScreenReader(buildConditionalFieldAnnouncement(sendTo, deliveryMethod));
    void trigger(["recipientPhone", "recipientEmail"]);
  }, [announceToScreenReader, clearErrors, deliveryMethod, sendTo, trigger]);

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
    writePaymentLoadingShell(paymentWindow);

    try {
      const requestBody: ScalevCheckoutRequest = {
        serviceId: service.id,
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail.trim(),
        customerPhone: normalizePhoneInput(data.customerPhone),
        recipientName: data.recipientName.trim(),
        recipientEmail: showRecipientEmail ? cleanOptionalText(data.recipientEmail) : undefined,
        recipientPhone: showRecipientPhone
          ? cleanOptionalText(normalizePhoneInput(data.recipientPhone ?? ""))
          : undefined,
        senderMessage: cleanOptionalText(data.senderMessage),
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

  const deliveryPreview = getDeliveryPreview(sendTo, deliveryMethod);

  const registerPhoneField = (fieldName: "customerPhone" | "recipientPhone") =>
    register(fieldName, {
      required:
        fieldName === "customerPhone"
          ? "Nomor WhatsApp wajib diisi"
          : showRecipientPhone
            ? "Nomor WhatsApp penerima wajib diisi"
            : false,
      pattern: {
        value: PHONE_PATTERN,
        message: "Gunakan format 08xxxxxxxx atau +62xxxxxxxx",
      },
      setValueAs: (value: unknown) =>
        typeof value === "string" ? normalizePhoneInput(value) : value,
    });

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
          className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Kembali ke halaman sebelumnya"
        >
          <ChevronLeft size={20} aria-hidden="true" className="transition-transform group-hover:-translate-x-1" />
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
                      <label htmlFor="recipient-name" className="mb-2 block text-sm font-medium text-muted-foreground">
                        Nama Penerima
                      </label>
                      <Input
                        id="recipient-name"
                        {...register("recipientName", {
                          required: "Nama penerima wajib diisi",
                        })}
                        autoComplete="name"
                        placeholder="Nama penerima voucher…"
                        className={errors.recipientName ? "border-destructive" : ""}
                      />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nama ini akan tercetak di voucher.
                    </p>
                    {errors.recipientName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.recipientName.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                      <label htmlFor="sender-message" className="mb-2 block text-sm font-medium text-muted-foreground">
                        Pesan untuk Penerima
                      </label>
                      <textarea
                        id="sender-message"
                        {...register("senderMessage")}
                        rows={3}
                        placeholder="Tulis pesan singkat jika mau…"
                        className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                  </div>

                  <div>
                    <p className="mb-2 block text-sm font-medium text-muted-foreground">
                      Kirim Voucher Ke
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: SendTo.RECIPIENT, label: "Langsung ke Penerima" },
                        { value: SendTo.PURCHASER, label: "Kirim ke Saya" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm transition-[border-color,background-color,color,box-shadow] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:text-base ${
                            sendTo === option.value
                              ? "border-primary bg-muted font-medium text-foreground"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            value={option.value}
                            {...register("sendTo", { required: true })}
                            className="sr-only"
                          />
                          {option.label}
                        </label>
                      ))}
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
                      { value: DeliveryMethod.WHATSAPP, label: "WhatsApp", icon: MessageCircle },
                      { value: DeliveryMethod.EMAIL, label: "Email", icon: Mail },
                      { value: DeliveryMethod.BOTH, label: "Email & WhatsApp", icon: Send },
                    ].map((method) => (
                      <label
                        key={method.value}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-[border-color,background-color,color,box-shadow] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                          deliveryMethod === method.value
                            ? "border-primary bg-muted"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          value={method.value}
                          {...register("deliveryMethod", { required: true })}
                          className="sr-only"
                        />
                        <method.icon size={20} aria-hidden="true" className="text-muted-foreground" />
                        <span className="text-sm text-foreground sm:text-base">
                          {method.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                     <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                       Ringkasan Pengiriman
                     </p>
                    <p className="mt-2 text-sm text-foreground">{deliveryPreview}</p>
                  </div>

                  {sendTo === SendTo.PURCHASER ? (
                    <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                      Voucher tetap memakai nama penerima di voucher, tetapi pengiriman akan dikirim ke kontak kamu.
                    </div>
                  ) : null}

                  {showRecipientPhone ? (
                    <div>
                      <label htmlFor="recipient-phone" className="mb-2 block text-sm font-medium text-muted-foreground">
                        WhatsApp Penerima
                      </label>
                      <Input
                        id="recipient-phone"
                        {...registerPhoneField("recipientPhone")}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+62 812 3456 7890…"
                        className={errors.recipientPhone ? "border-destructive" : ""}
                        aria-invalid={Boolean(errors.recipientPhone)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gunakan format 08xxxxxxxx atau +62xxxxxxxx
                      </p>
                      {errors.recipientPhone ? (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {errors.recipientPhone.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {showRecipientEmail ? (
                    <div>
                      <label htmlFor="recipient-email" className="mb-2 block text-sm font-medium text-muted-foreground">
                        Email Penerima
                      </label>
                      <Input
                        id="recipient-email"
                        {...register("recipientEmail", {
                          required: showRecipientEmail
                            ? "Email penerima wajib diisi"
                            : false,
                          pattern: showRecipientEmail
                            ? {
                                value: /^\S+@\S+$/i,
                                message: "Format email tidak valid",
                              }
                            : undefined,
                          setValueAs: (value: unknown) =>
                            typeof value === "string" ? value.trim() : value,
                        })}
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        placeholder="penerima@contoh.com…"
                        className={errors.recipientEmail ? "border-destructive" : ""}
                        aria-invalid={Boolean(errors.recipientEmail)}
                      />
                      {errors.recipientEmail ? (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {errors.recipientEmail.message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="animate-fade-slide-up animate-stagger-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <User size={20} aria-hidden="true" /> Data pembeli
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Kami gunakan untuk konfirmasi pembayaran dan bantuan jika ada kendala.
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="customer-name" className="mb-2 block text-sm font-medium text-muted-foreground">
                      Nama Lengkap
                    </label>
                    <Input
                      id="customer-name"
                      {...register("customerName", {
                        required: "Nama lengkap wajib diisi",
                        setValueAs: (value: unknown) =>
                          typeof value === "string" ? value.trim() : value,
                      })}
                      autoComplete="name"
                      placeholder="Nama lengkap kamu…"
                      className={errors.customerName ? "border-destructive" : ""}
                    />
                    {errors.customerName ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerName.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="customer-email" className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      id="customer-email"
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
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="nama@contoh.com…"
                      className={errors.customerEmail ? "border-destructive" : ""}
                    />
                    {errors.customerEmail ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerEmail.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="customer-phone" className="mb-2 block text-sm font-medium text-muted-foreground">
                      WhatsApp
                    </label>
                    <Input
                      id="customer-phone"
                      {...registerPhoneField("customerPhone")}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+62 812 3456 7890…"
                      className={errors.customerPhone ? "border-destructive" : ""}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Gunakan format 08xxxxxxxx atau +62xxxxxxxx
                    </p>
                    {errors.customerPhone ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {errors.customerPhone.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="animate-fade-slide-up animate-stagger-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
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
                         Sedang menyiapkan metode pembayaran…
                       </p>
                    </div>
                  </div>
                ) : paymentError ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
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
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-[border-color,background-color,color,box-shadow] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
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
                        <label htmlFor="sub-payment-method" className="block text-sm font-medium text-muted-foreground">
                          Bank Virtual Account
                        </label>
                        <select
                          id="sub-payment-method"
                          value={subPaymentMethod}
                          onChange={(event) =>
                            setSubPaymentMethod(event.target.value as ScalevVABankCode)
                          }
                          className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <div className="animate-scale-in rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-foreground">Ringkasan Pesanan</h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  1. Isi data  2. Bayar  3. Voucher dikirim
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
                    <h3 className="line-clamp-2 font-medium text-foreground">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">{service.duration} menit</p>
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
                  {formatCurrency(service.price)}
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

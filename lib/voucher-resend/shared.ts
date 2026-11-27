// Client-safe types and copy for the admin voucher resend. Server code lives in
// lib/actions/voucher-resend.ts.

export type ResendTarget = "RECIPIENT" | "BUYER" | "CUSTOM";

export type EmailDeliveryState = "SENT" | "FAILED" | "PENDING" | "NONE";

export interface VoucherDeliveryOverview {
  voucherId: string;
  orderItemId: string | null;
  code: string;
  serviceName: string | null;
  recipientName: string;
  recipientEmail: string | null;
  buyerEmail: string | null;
  whatsAppTarget: { kind: "RECIPIENT" | "BUYER"; phone: string } | null;
  isRedeemed: boolean;
  isExpired: boolean;
  email: {
    state: EmailDeliveryState;
    at: string | null;
  };
  lastResend: {
    status: "PENDING" | "SENT" | "FAILED";
    to: string | null;
    at: string;
    by: string | null;
  } | null;
}

export type ResendFailureStatus =
  | "invalid"
  | "invalid_email"
  | "no_address"
  | "not_found"
  | "not_paid"
  | "redeemed"
  | "expired"
  | "cooldown"
  | "rate_limited"
  | "provider_error"
  | "pdf_error"
  | "no_phone"
  | "network"
  | "error";

const DELIVERY_TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "27 Nov 16.51" in Asia/Jakarta, built from parts so ICU punctuation
// differences between runtimes don't change the text.
export function formatDeliveryTime(iso: string): string {
  const parts = Object.fromEntries(
    DELIVERY_TIME_FORMAT.formatToParts(new Date(iso)).map((part) => [part.type, part.value])
  );
  return `${parts.day} ${parts.month} ${parts.hour}.${parts.minute}`;
}

function minutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

export function resendFailureMessage(
  status: ResendFailureStatus | string,
  retryAfterSeconds?: number | null
): string {
  switch (status) {
    case "invalid":
      return "Data kirim ulang nggak lengkap. Tutup detail ini, lalu buka lagi.";
    case "invalid_email":
      return "Format email belum benar. Contoh: nama@gmail.com";
    case "no_address":
      return "Voucher ini belum punya email tujuan. Pilih Email lain.";
    case "not_found":
      return "Voucher ini nggak ketemu di penjualan ini. Muat ulang halaman.";
    case "not_paid":
      return "Penjualan belum lunas, jadi voucher belum bisa dikirim.";
    case "redeemed":
      return "Voucher sudah dipakai, jadi nggak dikirim ulang.";
    case "expired":
      return "Voucher sudah kedaluwarsa, jadi nggak dikirim ulang.";
    case "cooldown":
      return `Tunggu ${Math.max(1, retryAfterSeconds ?? 60)} detik sebelum kirim ulang lagi.`;
    case "rate_limited":
      return `Voucher ini sudah dikirim ulang 3 kali dalam 1 jam. Coba lagi ${minutes(retryAfterSeconds ?? 3600)} menit lagi.`;
    case "provider_error":
      return "Email ditolak penyedia email. Cek alamatnya, lalu coba lagi.";
    case "pdf_error":
      return "PDF voucher gagal dibuat, jadi email belum dikirim. Coba lagi sebentar lagi.";
    case "no_phone":
      return "Nomor WhatsApp tujuan nggak ada di penjualan ini.";
    case "forbidden":
      return "Akun kamu nggak punya akses kirim ulang voucher. Login ulang, lalu coba lagi.";
    case "network":
      return "Koneksi putus. Cek status kirim di detail ini sebelum coba lagi.";
    default:
      return "Gagal karena masalah di server. Coba lagi sebentar lagi.";
  }
}

export function resendBlockedReason(overview: Pick<VoucherDeliveryOverview, "isRedeemed" | "isExpired">): string | null {
  if (overview.isRedeemed) return "Voucher sudah dipakai.";
  if (overview.isExpired) return "Voucher sudah kedaluwarsa.";
  return null;
}

// One line for the voucher card: the newest of the order email and the last
// admin resend.
export function deliveryStatusLine(overview: VoucherDeliveryOverview): {
  tone: "ok" | "error" | "muted";
  text: string;
} {
  const resend = overview.lastResend;
  const emailAt = overview.email.at ? Date.parse(overview.email.at) : 0;
  if (resend && Date.parse(resend.at) >= emailAt) {
    const when = formatDeliveryTime(resend.at);
    if (resend.status === "SENT") {
      return { tone: "ok", text: `Dikirim ulang ke ${resend.to ?? "-"} · ${when}` };
    }
    if (resend.status === "FAILED") {
      return { tone: "error", text: `Kirim ulang ke ${resend.to ?? "-"} gagal · ${when}` };
    }
    return { tone: "muted", text: `Kirim ulang ke ${resend.to ?? "-"} belum selesai · ${when}` };
  }

  const email = overview.email;
  if (email.state === "SENT") {
    return {
      tone: "ok",
      text: `Email terkirim ke ${overview.recipientEmail ?? "-"}${email.at ? ` · ${formatDeliveryTime(email.at)}` : ""}`,
    };
  }
  if (email.state === "FAILED") {
    return {
      tone: "error",
      text: `Email gagal dikirim${email.at ? ` · ${formatDeliveryTime(email.at)}` : ""}`,
    };
  }
  if (email.state === "PENDING") {
    return { tone: "muted", text: "Email sedang diproses" };
  }
  return { tone: "muted", text: "Belum pernah dikirim lewat email" };
}

import type {
  ScalevCheckoutRequest,
  ScalevCreatePaymentResponse,
} from "@/lib/scalev/types";
import { isScalevHostedPublicOrderUrl } from "@/lib/scalev/urls";

export const POPUP_BLOCKED_MESSAGE =
  "Popup pembayaran diblokir browser. Buka halaman pembayaran dari halaman status pembayaran.";

export function writePaymentLoadingShell(paymentWindow: Window | null) {
  const popupDocument = paymentWindow?.document;
  if (!popupDocument) return;
  popupDocument.open();
  popupDocument.write(`<!doctype html><html lang="id"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Menyiapkan pembayaran...</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1ea;color:#2f241d;font-family:ui-sans-serif,system-ui,sans-serif}.card{width:min(100%,420px);border-radius:24px;padding:32px;background:#fffaf4;border:1px solid rgba(124,92,67,.14);box-shadow:0 18px 50px rgba(47,36,29,.08)}.spinner{display:inline-block;width:18px;height:18px;border-radius:999px;border:2px solid rgba(124,92,67,.12);border-top-color:#7c5c43;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><main class="card"><p><span class="spinner"></span> Kalanara Spa</p><h1>Menyiapkan halaman pembayaran...</h1><p>Jangan tutup tab ini. Kami sedang mengarahkan kamu ke pembayaran.</p></main></body></html>`);
  popupDocument.close();
}

export interface CompletedPayment {
  paymentOrderId: string;
  statusSessionId: string;
}

interface SubmitCheckoutPaymentOptions {
  request: ScalevCheckoutRequest;
  onPopupBlocked: () => void;
}

export async function submitCheckoutPayment({
  request,
  onPopupBlocked,
}: SubmitCheckoutPaymentOptions): Promise<CompletedPayment> {
  const paymentWindow = window.open("", "_blank");
  writePaymentLoadingShell(paymentWindow);

  try {
    const response = await fetch("/api/scalev/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = (await response.json()) as ScalevCreatePaymentResponse;
    if (
      !response.ok ||
      !result.success ||
      !result.paymentLink ||
      !result.paymentOrderId ||
      !result.statusSessionId
    ) {
      throw new Error(result.error || "Gagal membuat pembayaran.");
    }

    const shouldOpenPaymentWindow = !isScalevHostedPublicOrderUrl(
      result.paymentLink
    );
    if (paymentWindow && shouldOpenPaymentWindow) {
      paymentWindow.location.href = result.paymentLink;
    } else if (paymentWindow) {
      paymentWindow.close();
    } else if (shouldOpenPaymentWindow) {
      onPopupBlocked();
    }

    return {
      paymentOrderId: result.paymentOrderId,
      statusSessionId: result.statusSessionId,
    };
  } catch (error) {
    paymentWindow?.close();
    throw error;
  }
}

export function getPaymentStatusPath(payment: CompletedPayment) {
  return `/checkout/success?order_id=${encodeURIComponent(payment.paymentOrderId)}&status_session_id=${encodeURIComponent(payment.statusSessionId)}`;
}

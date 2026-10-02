import type { ScalevPaymentMethod } from "@/lib/scalev/types";

const PAYMENT_MARKS: Partial<
  Record<ScalevPaymentMethod, { src: string; wordmark: boolean }>
> = {
  qris: { src: "/payment/qris.svg", wordmark: true },
  dana: { src: "/payment/dana.svg", wordmark: true },
  ovo: { src: "/payment/ovo.svg", wordmark: true },
  shopeepay: { src: "/payment/shopeepay.svg", wordmark: false },
  gopay: { src: "/payment/gopay.svg", wordmark: true },
  linkaja: { src: "/payment/linkaja.svg", wordmark: true },
};

interface PaymentMethodMarkProps {
  code: ScalevPaymentMethod;
}

export function getPaymentMark(code: ScalevPaymentMethod) {
  return PAYMENT_MARKS[code] ?? null;
}

export function PaymentMethodMark({ code }: PaymentMethodMarkProps) {
  const mark = getPaymentMark(code);
  if (!mark) {
    return null;
  }

  return (
    // Brand marks stay local SVG files. next/image does not add value for these fixed icons.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark.src}
      alt=""
      className="h-7 w-auto max-w-24 object-contain"
    />
  );
}

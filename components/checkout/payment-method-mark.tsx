import type { ScalevPaymentMethod } from "@/lib/scalev/types";

const PAYMENT_MARKS: Partial<Record<ScalevPaymentMethod, string>> = {
  qris: "/payment/qris.svg",
  dana: "/payment/dana.svg",
  ovo: "/payment/ovo.svg",
  shopeepay: "/payment/shopeepay.svg",
  gopay: "/payment/gopay.svg",
  linkaja: "/payment/linkaja.svg",
};

interface PaymentMethodMarkProps {
  code: ScalevPaymentMethod;
}

export function PaymentMethodMark({ code }: PaymentMethodMarkProps) {
  const src = PAYMENT_MARKS[code];
  if (!src) {
    return null;
  }

  return (
    // Brand marks stay local SVG files. next/image does not add value for these fixed icons.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-7 w-auto max-w-16 object-contain"
    />
  );
}

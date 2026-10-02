import type {
  ScalevPaymentMethod,
  ScalevPaymentOption,
} from "@/lib/scalev/types";

export const PAYMENT_METHOD_ORDER: ScalevPaymentMethod[] = [
  "qris",
  "dana",
  "ovo",
  "shopeepay",
  "gopay",
  "linkaja",
  "va",
  "invoice",
];

function paymentRank(code: ScalevPaymentMethod) {
  const index = PAYMENT_METHOD_ORDER.indexOf(code);
  return index === -1 ? PAYMENT_METHOD_ORDER.length : index;
}

export function sortPaymentOptions(options: ScalevPaymentOption[]) {
  return [...options].sort(
    (left, right) => paymentRank(left.code) - paymentRank(right.code)
  );
}

export function preferredPaymentMethod(options: ScalevPaymentOption[]) {
  return sortPaymentOptions(options)[0]?.code ?? null;
}

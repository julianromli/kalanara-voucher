import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";

export const MEMBER_PHONE_PATTERN = /^62[0-9]{8,13}$/;

export function normalizeMemberPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("62") && digits.charAt(2) === "0") {
    digits = `62${digits.slice(3)}`;
  }

  const normalized = normalizeBuyerPhone(digits);
  return MEMBER_PHONE_PATTERN.test(normalized) ? normalized : null;
}

import { normalizeBuyerPhone } from "@/lib/admin/buyer-phone";

export const MEMBER_PHONE_PATTERN = /^62[0-9]{8,13}$/;

export function normalizeMemberPhone(phone: string): string | null {
  const normalized = normalizeBuyerPhone(phone);
  return MEMBER_PHONE_PATTERN.test(normalized) ? normalized : null;
}

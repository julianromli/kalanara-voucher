export function normalizeBuyerPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

export function formatBuyerPhone(phone: string) {
  const normalized = normalizeBuyerPhone(phone);
  const local = normalized.startsWith("62") ? normalized.slice(2) : "";
  if (local.length < 9) {
    return phone.trim();
  }

  return `+62 ${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
}

export function buyerPath(phone: string) {
  const normalized = normalizeBuyerPhone(phone);
  return normalized ? `/admin/buyers/${normalized}` : "/admin/buyers";
}

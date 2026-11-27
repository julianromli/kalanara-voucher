// Shared email checks for checkout and admin forms. Stricter than /\S+@\S+/:
// the domain needs a dot and a 2+ letter ending, so "nama@gmail" fails.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const EMAIL_MAX_LENGTH = 254;

export function normalizeEmailAddress(value: string): string {
  return value.trim();
}

export function isValidEmailAddress(value: string): boolean {
  const email = normalizeEmailAddress(value);
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

export function sameEmailAddress(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (!left || !right) return false;
  return normalizeEmailAddress(left).toLowerCase() === normalizeEmailAddress(right).toLowerCase();
}

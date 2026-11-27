// Shared email checks for checkout, the server checkout validation and the
// admin resend. Stricter than /\S+@\S+/: the domain needs a dot and a 2+
// letter ending, so "nama@gmail" fails.
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

// Popular inboxes in Indonesia. A domain one typo away from one of these
// (gmail.con, gmai.com, yahooo.com) or missing its ending (nama@gmail) gets a
// suggestion. Real domains that sit one letter away are left alone.
const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.id",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
];

const REAL_LOOKALIKE_DOMAINS = new Set([
  "mail.com",
  "email.com",
  "gmx.com",
  "aol.com",
  "yahoo.co.jp",
  "yahoo.co.uk",
  "yahoo.co.in",
  "live.co.uk",
  "outlook.co.id",
  "hotmail.co.uk",
]);

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) {
      i += 1;
    } else if (left.length < right.length) {
      j += 1;
    } else if (left[i + 1] === right[j] && left[i] === right[j + 1]) {
      // swapped letters: gmial.com
      i += 2;
      j += 2;
    } else {
      i += 1;
      j += 1;
    }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}

export function suggestEmailFix(value: string): string | null {
  const email = normalizeEmailAddress(value);
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_EMAIL_DOMAINS.includes(domain) || REAL_LOOKALIKE_DOMAINS.has(domain)) {
    return null;
  }

  if (!domain.includes(".")) {
    const match = COMMON_EMAIL_DOMAINS.find(
      (known) => known.split(".")[0] === domain || editDistanceAtMostOne(known.split(".")[0], domain)
    );
    return match ? `${local}@${match}` : null;
  }

  const match = COMMON_EMAIL_DOMAINS.find((known) => editDistanceAtMostOne(known, domain));
  return match ? `${local}@${match}` : null;
}

// One message for an email field: a likely typo first, then the format.
// Empty values pass; "required" is checked by the form.
export function emailFieldProblem(value: unknown): string | null {
  const email = typeof value === "string" ? normalizeEmailAddress(value) : "";
  if (!email) return null;
  const suggestion = suggestEmailFix(email);
  if (suggestion) return `Cek lagi emailnya. Maksudnya ${suggestion}?`;
  return isValidEmailAddress(email) ? null : "Format email tidak valid";
}

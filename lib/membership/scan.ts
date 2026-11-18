import { normalizeMemberPhone } from "@/lib/membership/phone";

const TOKEN_PATTERN = /^[0-9a-f]{48}$/i;
const MEMBER_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{6}$/;

export type MemberScan =
  | { kind: "empty" }
  | { kind: "rejected" }
  | { kind: "token"; token: string }
  | { kind: "phone"; phone: string }
  | { kind: "code"; code: string };

function allowedHosts(candidates: Array<string | undefined>): Set<string> {
  const hosts = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      hosts.add(new URL(candidate).host);
    } catch {
      continue;
    }
  }
  return hosts;
}

export function parseMemberScan(
  raw: string,
  options: { appUrl?: string; origin?: string } = {},
): MemberScan {
  const value = raw.trim();
  if (!value) return { kind: "empty" };

  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { kind: "rejected" };
    }

    const hosts = allowedHosts([options.appUrl, options.origin]);
    if (!hosts.has(url.host)) return { kind: "rejected" };

    const match = url.pathname.match(/^\/m\/([0-9a-f]{48})\/?$/i);
    if (!match) return { kind: "rejected" };
    return { kind: "token", token: match[1].toLowerCase() };
  }

  if (TOKEN_PATTERN.test(value)) {
    return { kind: "token", token: value.toLowerCase() };
  }

  const phoneShaped = /^[+(0-9][0-9\s().+-]{7,24}$/.test(value);
  const phone = phoneShaped ? normalizeMemberPhone(value) : null;
  if (phone) return { kind: "phone", phone };

  const code = value.toUpperCase();
  if (MEMBER_CODE_PATTERN.test(code)) {
    return { kind: "code", code };
  }

  return { kind: "rejected" };
}

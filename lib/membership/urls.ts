export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    throw new Error("NEXT_PUBLIC_APP_URL belum dikonfigurasi.");
  }
  return raw.replace(/\/$/, "");
}

export function tryAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : "";
}

export function memberCardUrl(token: string): string {
  return `${appBaseUrl()}/m/${token}`;
}

export function signupPageUrl(token: string): string {
  return `${appBaseUrl()}/daftar/${token}`;
}

export function tokenTail(token: string): string {
  return token.slice(-4);
}

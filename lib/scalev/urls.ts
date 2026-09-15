const DEFAULT_SCALEV_PUBLIC_BASE_URL = "https://app.scalev.id";
const OFFICIAL_SCALEV_HOSTNAMES = [
  "app.scalev.id",
  "checkout.scalev.id",
] as const;
const APP_SCALEV_PATH_PREFIXES = ["/order/public", "/pay", "/invoice"] as const;
const CHECKOUT_SCALEV_PATH_PREFIXES = ["/pay", "/invoice"] as const;

function getConfiguredScalevPublicBaseUrl() {
  return (
    process.env.SCALEV_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_SCALEV_PUBLIC_BASE_URL
  );
}

function parseTrustedBaseUrl(value: string): URL | null {
  if (hasUnsafePathEncoding(value) || hasExplicitPort(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getRawPath(value: string) {
  const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(value);
  return match?.[1] || "/";
}

function hasExplicitPort(value: string) {
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(value)?.[1];
  if (!authority) {
    return false;
  }

  const host = authority.slice(authority.lastIndexOf("@") + 1);
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 && host.slice(closingBracket + 1).startsWith(":");
  }

  return host.includes(":");
}

function repeatedlyDecode(value: string) {
  let decoded = value;
  for (let index = 0; index < 5; index += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) {
      return decoded;
    }
    decoded = next;
  }
  return decoded;
}

function hasUnsafePathEncoding(value: string) {
  try {
    const rawPath = getRawPath(value);
    if (rawPath.includes("\\")) {
      return true;
    }

    return rawPath.split("/").some((segment) => {
      const decoded = repeatedlyDecode(segment);
      return (
        decoded === "." ||
        decoded === ".." ||
        decoded.includes("/") ||
        decoded.includes("\\")
      );
    });
  } catch {
    return true;
  }
}

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isConfiguredBaseDescendant(url: URL, configuredBase: URL | null) {
  if (!configuredBase || url.origin !== configuredBase.origin) {
    return false;
  }

  const basePath = configuredBase.pathname.replace(/\/+$/, "");
  if (!basePath) {
    return !OFFICIAL_SCALEV_HOSTNAMES.some(
      (hostname) => hostname === configuredBase.hostname.toLowerCase()
    );
  }

  return url.pathname.startsWith(`${basePath}/`);
}

function hasAllowedScalevPath(url: URL, configuredBase: URL | null) {
  const hostname = url.hostname.toLowerCase();
  const officialPrefixes =
    hostname === "app.scalev.id"
      ? APP_SCALEV_PATH_PREFIXES
      : hostname === "checkout.scalev.id"
        ? CHECKOUT_SCALEV_PATH_PREFIXES
        : [];

  return (
    officialPrefixes.some((prefix) =>
      pathMatchesPrefix(url.pathname, prefix)
    ) || isConfiguredBaseDescendant(url, configuredBase)
  );
}

export function sanitizeScalevPublicUrl(
  value?: string | null,
  configuredPublicBaseUrl = getConfiguredScalevPublicBaseUrl()
): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalizedValue = value.trim();
  if (
    hasUnsafePathEncoding(normalizedValue) ||
    hasExplicitPort(normalizedValue)
  ) {
    return null;
  }

  const configuredBase = parseTrustedBaseUrl(configuredPublicBaseUrl);
  const allowedHostnames = new Set<string>(OFFICIAL_SCALEV_HOSTNAMES);
  if (configuredBase) {
    allowedHostnames.add(configuredBase.hostname.toLowerCase());
  }

  try {
    const url = new URL(normalizedValue);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedHostnames.has(url.hostname.toLowerCase()) ||
      !hasAllowedScalevPath(url, configuredBase)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeExternalPaymentUrl(
  value?: string | null
): string | null {
  if (
    !value?.trim() ||
    hasUnsafePathEncoding(value.trim()) ||
    hasExplicitPort(value.trim())
  ) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeOrderPaymentUrl(
  value: string | null | undefined,
  provider: string | null | undefined
) {
  return provider?.toLowerCase() === "scalev"
    ? sanitizeScalevPublicUrl(value)
    : sanitizeExternalPaymentUrl(value);
}

export function buildScalevPublicOrderUrl(
  secretSlug?: string | null,
  configuredPublicBaseUrl = getConfiguredScalevPublicBaseUrl()
) {
  if (!secretSlug) {
    return null;
  }

  const normalized = secretSlug.trim();
  if (!normalized) {
    return null;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(normalized) || normalized.startsWith("//")) {
    return sanitizeScalevPublicUrl(normalized, configuredPublicBaseUrl);
  }

  const trimmedPath = normalized.replace(/^\/+/, "");
  const configuredBase = parseTrustedBaseUrl(configuredPublicBaseUrl);
  const baseUrl = (
    configuredBase
      ? `${configuredBase.origin}${configuredBase.pathname}`
      : DEFAULT_SCALEV_PUBLIC_BASE_URL
  ).replace(/\/+$/, "");
  const candidate = trimmedPath.startsWith("order/public/")
    ? `${baseUrl}/${trimmedPath}`
    : `${baseUrl}/order/public/${trimmedPath}`;

  return sanitizeScalevPublicUrl(candidate, configuredPublicBaseUrl);
}

export function isScalevHostedPublicOrderUrl(urlValue?: string | null) {
  if (!urlValue) {
    return false;
  }

  try {
    const url = new URL(urlValue);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return false;
    }

    // This is a UI classification only. Server boundaries sanitize and
    // allowlist every payment URL before it reaches browser code.
    return (
      url.pathname.includes("/order/public/") ||
      url.pathname.startsWith("/pay/") ||
      url.pathname.startsWith("/invoice/")
    );
  } catch {
    return false;
  }
}

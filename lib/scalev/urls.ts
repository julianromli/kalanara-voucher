const DEFAULT_SCALEV_PUBLIC_BASE_URL = "https://app.scalev.id";
const OFFICIAL_SCALEV_HOSTNAMES = [
  "app.scalev.id",
  "checkout.scalev.id",
] as const;

function getConfiguredScalevPublicBaseUrl() {
  return (
    process.env.SCALEV_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_SCALEV_PUBLIC_BASE_URL
  );
}

function parseTrustedBaseUrl(value: string): URL | null {
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

export function sanitizeScalevPublicUrl(
  value?: string | null,
  configuredPublicBaseUrl = getConfiguredScalevPublicBaseUrl()
): string | null {
  if (!value?.trim()) {
    return null;
  }

  const configuredBase = parseTrustedBaseUrl(configuredPublicBaseUrl);
  const allowedHostnames = new Set<string>(OFFICIAL_SCALEV_HOSTNAMES);
  if (configuredBase) {
    allowedHostnames.add(configuredBase.hostname.toLowerCase());
  }

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !allowedHostnames.has(url.hostname.toLowerCase())
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
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

const DEFAULT_SCALEV_PUBLIC_BASE_URL = "https://app.scalev.id";

function getScalevPublicBaseUrl() {
  return (
    process.env.SCALEV_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_SCALEV_PUBLIC_BASE_URL
  );
}

export function buildScalevPublicOrderUrl(secretSlug?: string | null) {
  if (!secretSlug) {
    return null;
  }

  const normalized = secretSlug.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const trimmedPath = normalized.replace(/^\/+/, "");
  const baseUrl = getScalevPublicBaseUrl();

  if (trimmedPath.startsWith("order/public/")) {
    return `${baseUrl}/${trimmedPath}`;
  }

  return `${baseUrl}/order/public/${trimmedPath}`;
}

const SERVICE_IMAGE_BUCKET = "services";
const MAX_SERVICE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SERVICE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_SERVICE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
const DEFAULT_SERVICE_IMAGE_URL =
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80";

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const parts = trimmed.split(".");
  const extension = parts.length > 1 ? parts.pop() || "" : "";
  const baseName = parts.join(".") || trimmed;
  const sanitizedBaseName = baseName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const safeBaseName = sanitizedBaseName || "image";
  const safeExtension = extension.replace(/[^\w]+/g, "").slice(0, 10);

  return safeExtension ? `${safeBaseName}.${safeExtension}` : safeBaseName;
}

export function buildServiceImagePath(scopeId: string, fileName: string) {
  const timestamp = Date.now();
  const safeScopeId = scopeId.replace(/[^\w/-]+/g, "-");

  return `${safeScopeId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

export function getServiceImageBucket() {
  return SERVICE_IMAGE_BUCKET;
}

export function getDefaultServiceImageUrl() {
  return DEFAULT_SERVICE_IMAGE_URL;
}

export function getAllowedServiceImageTypes() {
  return [...ALLOWED_SERVICE_IMAGE_TYPES];
}

export function getAllowedServiceImageExtensions() {
  return [...ALLOWED_SERVICE_IMAGE_EXTENSIONS];
}

export function getMaxServiceImageSizeBytes() {
  return MAX_SERVICE_IMAGE_SIZE_BYTES;
}

export function hasServiceImage(imageUrl: string | null | undefined) {
  return Boolean(imageUrl?.trim());
}

export function resolveServiceImageUrl(imageUrl: string | null | undefined) {
  if (hasServiceImage(imageUrl)) {
    return imageUrl!.trim();
  }

  return DEFAULT_SERVICE_IMAGE_URL;
}

export function isAllowedServiceImageType(contentType: string) {
  return ALLOWED_SERVICE_IMAGE_TYPES.includes(
    contentType as (typeof ALLOWED_SERVICE_IMAGE_TYPES)[number]
  );
}

export function isSupabaseServiceImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return false;
  }

  try {
    const url = new URL(imageUrl);
    return (
      url.pathname.includes(`/storage/v1/object/public/${SERVICE_IMAGE_BUCKET}/`) ||
      url.pathname.includes(`/storage/v1/object/sign/${SERVICE_IMAGE_BUCKET}/`)
    );
  } catch {
    return false;
  }
}

export function getServiceImageObjectPath(imageUrl: string | null | undefined) {
  if (!isSupabaseServiceImageUrl(imageUrl) || !imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const publicPrefix = `/storage/v1/object/public/${SERVICE_IMAGE_BUCKET}/`;
    const signedPrefix = `/storage/v1/object/sign/${SERVICE_IMAGE_BUCKET}/`;

    if (url.pathname.includes(publicPrefix)) {
      return decodeURIComponent(url.pathname.split(publicPrefix)[1] || "");
    }

    if (url.pathname.includes(signedPrefix)) {
      return decodeURIComponent(url.pathname.split(signedPrefix)[1] || "");
    }
  } catch {
    return null;
  }

  return null;
}

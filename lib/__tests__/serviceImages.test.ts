import { describe, expect, it } from "vitest";
import {
  getDefaultServiceImageUrl,
  getServiceImageObjectPath,
  getUploadThingFileKey,
  hasServiceImage,
  isManagedServiceImageUrl,
  isUploadThingServiceImageUrl,
  isSupabaseServiceImageUrl,
  resolveServiceImageUrl,
} from "@/lib/utils/serviceImages";

describe("serviceImages utilities", () => {
  it("extracts the object path from a public storage URL", () => {
    const url =
      "https://example.supabase.co/storage/v1/object/public/services/services/service-123/123456-photo.webp";

    expect(getServiceImageObjectPath(url)).toBe("services/service-123/123456-photo.webp");
  });

  it("extracts the UploadThing file key from a managed URL", () => {
    const url = "https://app-id.ufs.sh/f/service-image-key.webp";

    expect(isUploadThingServiceImageUrl(url)).toBe(true);
    expect(getUploadThingFileKey(url)).toBe("service-image-key.webp");
  });

  it("ignores non-supabase or legacy image URLs", () => {
    expect(isSupabaseServiceImageUrl("/images/services/balinese-massage.jpg")).toBe(false);
    expect(getServiceImageObjectPath("https://images.unsplash.com/photo-1")).toBeNull();
    expect(isUploadThingServiceImageUrl("https://images.unsplash.com/photo-1")).toBe(false);
    expect(getUploadThingFileKey("https://images.unsplash.com/photo-1")).toBeNull();
  });

  it("resolves null image URLs to the shared fallback", () => {
    expect(resolveServiceImageUrl(null)).toBe(getDefaultServiceImageUrl());
    expect(resolveServiceImageUrl("   ")).toBe(getDefaultServiceImageUrl());
  });

  it("preserves valid external and Supabase image URLs", () => {
    const externalUrl = "https://images.unsplash.com/photo-1";
    const supabaseUrl =
      "https://example.supabase.co/storage/v1/object/public/services/services/service-123/photo.webp";

    expect(resolveServiceImageUrl(externalUrl)).toBe(externalUrl);
    expect(resolveServiceImageUrl(supabaseUrl)).toBe(supabaseUrl);
  });

  it("detects managed service image URLs across providers", () => {
    expect(isManagedServiceImageUrl("https://app-id.ufs.sh/f/service-image-key.webp")).toBe(true);
    expect(
      isManagedServiceImageUrl(
        "https://example.supabase.co/storage/v1/object/public/services/services/service-123/photo.webp"
      )
    ).toBe(true);
    expect(isManagedServiceImageUrl("https://images.unsplash.com/photo-1")).toBe(false);
  });

  it("detects whether a service has a configured image", () => {
    expect(hasServiceImage("https://images.unsplash.com/photo-1")).toBe(true);
    expect(hasServiceImage("   ")).toBe(false);
    expect(hasServiceImage(null)).toBe(false);
  });
});

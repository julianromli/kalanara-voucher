import { describe, expect, it } from "vitest";
import {
  buildServiceImagePath,
  getDefaultServiceImageUrl,
  getServiceImageObjectPath,
  hasServiceImage,
  isSupabaseServiceImageUrl,
  resolveServiceImageUrl,
} from "@/lib/utils/serviceImages";

describe("serviceImages utilities", () => {
  it("builds a stable service image path", () => {
    const path = buildServiceImagePath("services/service-123", "Balinese Massage.JPG");

    expect(path).toMatch(/^services\/service-123\/\d+-balinese-massage\.jpg$/);
  });

  it("extracts the object path from a public storage URL", () => {
    const url =
      "https://example.supabase.co/storage/v1/object/public/services/services/service-123/123456-photo.webp";

    expect(getServiceImageObjectPath(url)).toBe("services/service-123/123456-photo.webp");
  });

  it("ignores non-supabase or legacy image URLs", () => {
    expect(isSupabaseServiceImageUrl("/images/services/balinese-massage.jpg")).toBe(false);
    expect(getServiceImageObjectPath("https://images.unsplash.com/photo-1")).toBeNull();
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

  it("detects whether a service has a configured image", () => {
    expect(hasServiceImage("https://images.unsplash.com/photo-1")).toBe(true);
    expect(hasServiceImage("   ")).toBe(false);
    expect(hasServiceImage(null)).toBe(false);
  });
});

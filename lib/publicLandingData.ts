import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  LANDING_CMS_CACHE_TAG,
  PUBLIC_SERVICES_CACHE_TAG,
} from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import {
  parseLandingCopyFromSettings,
  PUBLIC_LANDING_SETTING_KEYS,
  type LandingCopy,
} from "@/lib/landingCopy";
import {
  loadActivePublicServices,
  type ServiceCategoryRelation,
  type ServiceWithCategory,
} from "@/lib/publicServices";
import { getAdminClient } from "@/lib/supabase/admin";

export type PublicServiceCategory = ServiceCategoryRelation;
export type PublicServiceWithCategory = ServiceWithCategory;

export interface PublicLandingData {
  services: PublicServiceWithCategory[];
  heroImageUrl?: string;
  testimonials: Database["public"]["Tables"]["testimonials"]["Row"][];
  landingCopy: LandingCopy;
}

export async function getPublicLandingData(): Promise<PublicLandingData> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_SERVICES_CACHE_TAG, LANDING_CMS_CACHE_TAG);

  const supabase = getAdminClient();
  const [services, settingsResult, testimonialResult] = await Promise.all([
    loadActivePublicServices(supabase),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [...PUBLIC_LANDING_SETTING_KEYS]),
    supabase
      .from("testimonials")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (settingsResult.error) {
    throw settingsResult.error;
  }
  if (testimonialResult.error) {
    throw testimonialResult.error;
  }

  const settingRows = settingsResult.data || [];
  const heroImageUrl = settingRows.find(
    (row) => row.key === "hero_image_url"
  )?.value;

  return {
    services,
    heroImageUrl,
    testimonials: testimonialResult.data || [],
    landingCopy: parseLandingCopyFromSettings(settingRows),
  };
}

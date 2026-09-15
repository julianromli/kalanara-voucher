import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  LANDING_CMS_CACHE_TAG,
  PUBLIC_SERVICES_CACHE_TAG,
} from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
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
}

export async function getPublicLandingData(): Promise<PublicLandingData> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_SERVICES_CACHE_TAG, LANDING_CMS_CACHE_TAG);

  const supabase = getAdminClient();
  const [services, heroResult, testimonialResult] = await Promise.all([
    loadActivePublicServices(supabase),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "hero_image_url")
      .maybeSingle(),
    supabase
      .from("testimonials")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (heroResult.error) {
    throw heroResult.error;
  }
  if (testimonialResult.error) {
    throw testimonialResult.error;
  }

  return {
    services,
    heroImageUrl: heroResult.data?.value,
    testimonials: testimonialResult.data || [],
  };
}

import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  LANDING_CMS_CACHE_TAG,
  PUBLIC_SERVICES_CACHE_TAG,
} from "@/lib/cache-tags";
import type { Database, Service } from "@/lib/database.types";
import { getAdminClient } from "@/lib/supabase/admin";

export type PublicServiceCategory =
  Database["public"]["Tables"]["service_categories"]["Row"];

export type PublicServiceWithCategory = Service & {
  category_relation: PublicServiceCategory | null;
};

export interface PublicLandingData {
  services: PublicServiceWithCategory[];
  heroImageUrl?: string;
  testimonials: Database["public"]["Tables"]["testimonials"]["Row"][];
}

const SERVICE_WITH_CATEGORY_SELECT =
  "*, category_relation:service_categories!category_id(*)";
const PGRST_EMBED_RELATION_MISSING = "PGRST200";

async function loadPublicServices(): Promise<PublicServiceWithCategory[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!error) {
    return (data as PublicServiceWithCategory[]) || [];
  }

  if (error.code !== PGRST_EMBED_RELATION_MISSING) {
    console.error("Error fetching public services:", error);
    return [];
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (servicesError) {
    console.error("Error fetching public services:", servicesError);
    return [];
  }

  const categoryIds = Array.from(
    new Set(
      (services || [])
        .map((service) => service.category_id)
        .filter((categoryId): categoryId is string => Boolean(categoryId))
    )
  );

  if (categoryIds.length === 0) {
    return (services || []).map((service) => ({
      ...service,
      category_relation: null,
    }));
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("service_categories")
    .select("*")
    .in("id", categoryIds);

  if (categoriesError) {
    console.error("Error fetching public service categories:", categoriesError);
  }

  const categoriesById = new Map(
    (categories || []).map((category) => [category.id, category])
  );

  return (services || []).map((service) => ({
    ...service,
    category_relation: service.category_id
      ? categoriesById.get(service.category_id) || null
      : null,
  }));
}

export async function getPublicLandingData(): Promise<PublicLandingData> {
  "use cache";
  cacheLife("hours");
  cacheTag(PUBLIC_SERVICES_CACHE_TAG, LANDING_CMS_CACHE_TAG);

  const supabase = getAdminClient();
  const [services, heroResult, testimonialResult] = await Promise.all([
    loadPublicServices(),
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
    console.error("Error fetching public hero image:", heroResult.error);
  }
  if (testimonialResult.error) {
    console.error(
      "Error fetching public testimonials:",
      testimonialResult.error
    );
  }

  return {
    services,
    heroImageUrl: heroResult.data?.value,
    testimonials: testimonialResult.data || [],
  };
}

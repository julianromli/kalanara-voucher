import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Service } from "@/lib/database.types";

export type ServiceCategoryRelation =
  Database["public"]["Tables"]["service_categories"]["Row"];

export type ServiceWithCategory = Service & {
  category_relation: ServiceCategoryRelation | null;
};

const SERVICE_WITH_CATEGORY_SELECT =
  "*, category_relation:service_categories!category_id(*)";
const SERVICE_BASE_SELECT = "*";
const PGRST_EMBED_RELATION_MISSING = "PGRST200";

export async function loadActivePublicServices(
  supabase: SupabaseClient<Database>
): Promise<ServiceWithCategory[]> {
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!error) {
    return (data as ServiceWithCategory[]) || [];
  }

  if (error.code !== PGRST_EMBED_RELATION_MISSING) {
    throw error;
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select(SERVICE_BASE_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (servicesError) {
    throw servicesError;
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
    .select(SERVICE_BASE_SELECT)
    .in("id", categoryIds);

  if (categoriesError) {
    throw categoriesError;
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

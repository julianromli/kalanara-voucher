"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database, Service, ServiceInsert, ServiceUpdate } from "@/lib/database.types";

export type ServiceCategoryRelation =
  Database["public"]["Tables"]["service_categories"]["Row"];

export type ServiceWithCategory = Service & {
  category_relation: ServiceCategoryRelation | null;
};

const SERVICE_WITH_CATEGORY_SELECT =
  "*, category_relation:service_categories!category_id(*)";
const SERVICE_BASE_SELECT = "*";
const PGRST_EMBED_RELATION_MISSING = "PGRST200";

type ServiceClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof getAdminClient>;

function isPgrstEmbedRelationMissing(error: { code?: string } | null): boolean {
  return error?.code === PGRST_EMBED_RELATION_MISSING;
}

async function stitchCategoryRelations(
  supabase: ServiceClient,
  services: Service[]
): Promise<ServiceWithCategory[]> {
  const categoryIds = Array.from(
    new Set(
      services
        .map((service) => service.category_id)
        .filter((categoryId): categoryId is string => Boolean(categoryId))
    )
  );

  if (categoryIds.length === 0) {
    return services.map((service) => ({
      ...service,
      category_relation: null,
    }));
  }

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .in("id", categoryIds);

  if (error) {
    console.error("Error fetching service categories:", error);

    return services.map((service) => ({
      ...service,
      category_relation: null,
    }));
  }

  const categoriesById = new Map((data || []).map((category) => [category.id, category]));

  return services.map((service) => ({
    ...service,
    category_relation: service.category_id
      ? categoriesById.get(service.category_id) || null
      : null,
  }));
}

function revalidateServiceCatalogData() {
  revalidateTag("dashboard-stats", "max");
  revalidatePath("/", "page");
  revalidatePath("/admin/services", "page");
  revalidatePath("/checkout/[id]", "page");
  revalidatePath("/voucher/[id]", "page");
}

export async function getServices(): Promise<ServiceWithCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!error) {
    return (data as ServiceWithCategory[]) || [];
  }

  if (!isPgrstEmbedRelationMissing(error)) {
    console.error("Error fetching services:", error);
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("services")
    .select(SERVICE_BASE_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (fallbackError) {
    console.error("Error fetching services:", fallbackError);
    return [];
  }

  return stitchCategoryRelations(supabase, fallbackData || []);
}

export async function getAllServices(): Promise<ServiceWithCategory[]> {
  await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .order("created_at", { ascending: true });

  if (!error) {
    return (data as ServiceWithCategory[]) || [];
  }

  if (!isPgrstEmbedRelationMissing(error)) {
    console.error("Error fetching all services:", error);
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("services")
    .select(SERVICE_BASE_SELECT)
    .order("created_at", { ascending: true });

  if (fallbackError) {
    console.error("Error fetching all services:", fallbackError);
    return [];
  }

  return stitchCategoryRelations(supabase, fallbackData || []);
}

export async function getServiceById(id: string): Promise<ServiceWithCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("id", id)
    .single();

  if (!error) {
    return data;
  }

  if (!isPgrstEmbedRelationMissing(error)) {
    console.error("Error fetching service:", error);
    return null;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("services")
    .select(SERVICE_BASE_SELECT)
    .eq("id", id)
    .single();

  if (fallbackError || !fallbackData) {
    if (fallbackError) {
      console.error("Error fetching service:", fallbackError);
    }

    return null;
  }

  const [service] = await stitchCategoryRelations(supabase, [fallbackData]);
  return service || null;
}

export async function getActiveServicesForScalevSync(): Promise<ServiceWithCategory[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!error) {
    return (data as ServiceWithCategory[]) || [];
  }

  if (!isPgrstEmbedRelationMissing(error)) {
    console.error("Error fetching services for Scalev sync:", error);
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("services")
    .select(SERVICE_BASE_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (fallbackError) {
    console.error("Error fetching services for Scalev sync:", fallbackError);
    return [];
  }

  return stitchCategoryRelations(supabase, fallbackData || []);
}

export async function createService(service: ServiceInsert): Promise<ServiceWithCategory | null> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .insert(service)
    .select(SERVICE_BASE_SELECT)
    .single();

  if (error) {
    console.error("Error creating service:", error);
    return null;
  }

  const [serviceWithCategory] = await stitchCategoryRelations(supabase, [data]);

  logAdminAudit(access, {
    action: "service.create",
    target: serviceWithCategory.id,
    details: { name: serviceWithCategory.name },
  });

  revalidateServiceCatalogData();
  return serviceWithCategory;
}

export async function updateService(
  id: string,
  updates: ServiceUpdate
): Promise<ServiceWithCategory | null> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", id)
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .single();

  if (error) {
    if (!isPgrstEmbedRelationMissing(error)) {
      console.error("Error updating service:", error);
      return null;
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("services")
      .select(SERVICE_BASE_SELECT)
      .eq("id", id)
      .single();

    if (fallbackError || !fallbackData) {
      if (fallbackError) {
        console.error("Error updating service:", fallbackError);
      }

      return null;
    }

    const [serviceWithCategory] = await stitchCategoryRelations(supabase, [fallbackData]);

    logAdminAudit(access, {
      action: "service.update",
      target: serviceWithCategory.id,
      details: { name: serviceWithCategory.name },
    });

    revalidateServiceCatalogData();
    return serviceWithCategory;
  }

  logAdminAudit(access, {
    action: "service.update",
    target: data.id,
    details: { name: data.name },
  });

  revalidateServiceCatalogData();
  return data as ServiceWithCategory;
}

export async function updateServiceScalevMapping(
  id: string,
  updates: Pick<
    ServiceUpdate,
    | "scalev_product_id"
    | "scalev_variant_id"
    | "scalev_variant_unique_id"
    | "scalev_sync_status"
    | "scalev_last_synced_at"
  >
): Promise<Service | null> {
  await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating service Scalev mapping:", error);
    return null;
  }

  revalidateServiceCatalogData();
  return data;
}

export async function deleteService(id: string): Promise<boolean> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = getAdminClient();
  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("services")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deleting service:", error);
    return false;
  }

  logAdminAudit(access, {
    action: "service.deactivate",
    target: id,
  });

  revalidateServiceCatalogData();
  return true;
}

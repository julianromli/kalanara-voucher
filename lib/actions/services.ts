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
  "*, category_relation:service_categories!services_category_id_fkey(*)";

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

  if (error) {
    console.error("Error fetching services:", error);
    return [];
  }

  return (data as ServiceWithCategory[]) || [];
}

export async function getAllServices(): Promise<ServiceWithCategory[]> {
  await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching all services:", error);
    return [];
  }

  return (data as ServiceWithCategory[]) || [];
}

export async function getServiceById(id: string): Promise<ServiceWithCategory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching service:", error);
    return null;
  }

  return data;
}

export async function getActiveServicesForScalevSync(): Promise<ServiceWithCategory[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching services for Scalev sync:", error);
    return [];
  }

  return (data as ServiceWithCategory[]) || [];
}

export async function createService(service: ServiceInsert): Promise<ServiceWithCategory | null> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("services")
    .insert(service)
    .select(SERVICE_WITH_CATEGORY_SELECT)
    .single();

  if (error) {
    console.error("Error creating service:", error);
    return null;
  }

  logAdminAudit(access, {
    action: "service.create",
    target: data.id,
    details: { name: data.name },
  });

  revalidateServiceCatalogData();
  return data as ServiceWithCategory;
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
    console.error("Error updating service:", error);
    return null;
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

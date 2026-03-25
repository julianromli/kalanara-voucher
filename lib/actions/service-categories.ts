"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type ServiceCategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];
type ServiceCategoryInsert = Database["public"]["Tables"]["service_categories"]["Insert"];
type ServiceCategoryUpdate = Database["public"]["Tables"]["service_categories"]["Update"];

interface ServiceCategoryNameConflictCheckResult {
  readonly data: Pick<ServiceCategoryRow, "id" | "name"> | null;
  readonly error: { message?: string } | null;
}

export interface ServiceCategoryInput {
  readonly name: string;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
}

function revalidateServiceCategoryData() {
  revalidateTag("dashboard-stats", "max");
  revalidatePath("/", "page");
  revalidatePath("/admin/services", "page");
  revalidatePath("/checkout/[id]", "page");
  revalidatePath("/voucher/[id]", "page");
}

function normalizeCategoryName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Nama kategori layanan wajib diisi.");
  }

  return trimmedName;
}

function createStableCategorySlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureCategoryNameIsUnique(
  supabase: ReturnType<typeof getAdminClient>,
  normalizedName: string,
  currentCategoryId?: string
) {
  const { data, error } = (await supabase
    .from("service_categories")
    .select("id, name")
    .ilike("name", normalizedName)
    .maybeSingle()) as ServiceCategoryNameConflictCheckResult;

  if (error) {
    console.error("Error checking service category uniqueness:", error);
    throw new Error("Gagal memeriksa duplikasi kategori layanan.");
  }

  if (data && data.id !== currentCategoryId) {
    throw new Error("Nama kategori layanan sudah digunakan.");
  }
}

async function getExistingCategoryOrThrow(id: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Kategori layanan tidak ditemukan.");
  }

  return data as ServiceCategoryRow;
}

export async function getServiceCategoriesForAssignment(): Promise<ServiceCategoryRow[]> {
  await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching assignable service categories:", error);
    return [];
  }

  return data || [];
}

export async function getAllServiceCategories(): Promise<ServiceCategoryRow[]> {
  await requireAdminPermission(AdminPermission.SERVICES_MANAGE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching all service categories:", error);
    return [];
  }

  return data || [];
}

export async function createServiceCategory(
  input: ServiceCategoryInput
): Promise<ServiceCategoryRow> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);
  const supabase = getAdminClient();
  const normalizedName = normalizeCategoryName(input.name);
  const slug = createStableCategorySlug(normalizedName);

  if (!slug) {
    throw new Error("Slug kategori layanan tidak valid.");
  }

  await ensureCategoryNameIsUnique(supabase, normalizedName);

  const payload: ServiceCategoryInsert = {
    name: normalizedName,
    slug,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  const { data, error } = await supabase
    .from("service_categories")
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating service category:", error);
    throw new Error("Gagal membuat kategori layanan.");
  }

  logAdminAudit(access, {
    action: "service_category.create",
    target: data.id,
    details: {
      name: data.name,
      slug: data.slug,
      isActive: data.is_active,
    },
  });

  revalidateServiceCategoryData();
  return data as ServiceCategoryRow;
}

export async function updateServiceCategory(
  id: string,
  input: ServiceCategoryInput
): Promise<ServiceCategoryRow> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);
  const supabase = getAdminClient();
  const existingCategory = await getExistingCategoryOrThrow(id);
  const normalizedName = normalizeCategoryName(input.name);

  await ensureCategoryNameIsUnique(supabase, normalizedName, existingCategory.id);

  const updates: ServiceCategoryUpdate = {
    name: normalizedName,
    is_active: input.isActive ?? existingCategory.is_active,
    sort_order: input.sortOrder ?? existingCategory.sort_order,
  };

  const { data, error } = await supabase
    .from("service_categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("Error updating service category:", error);
    throw new Error("Gagal memperbarui kategori layanan.");
  }

  logAdminAudit(access, {
    action: "service_category.update",
    target: data.id,
    details: {
      name: data.name,
      slug: data.slug,
      isActive: data.is_active,
    },
  });

  revalidateServiceCategoryData();
  return data as ServiceCategoryRow;
}

export async function deleteServiceCategory(id: string): Promise<boolean> {
  const access = await requireAdminPermission(AdminPermission.SERVICES_MANAGE);
  const supabase = getAdminClient();

  await getExistingCategoryOrThrow(id);

  const { count, error: referenceError } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (referenceError) {
    console.error("Error checking service category references:", referenceError);
    throw new Error("Gagal memeriksa penggunaan kategori layanan.");
  }

  if ((count ?? 0) > 0) {
    throw new Error("Kategori layanan masih dipakai oleh layanan yang ada.");
  }

  const { error } = await supabase.from("service_categories").delete().eq("id", id);

  if (error) {
    console.error("Error deleting service category:", error);
    throw new Error("Gagal menghapus kategori layanan.");
  }

  logAdminAudit(access, {
    action: "service_category.delete",
    target: id,
  });

  revalidateServiceCategoryData();
  return true;
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import type { SiteSetting, Testimonial, TestimonialInsert, TestimonialUpdate } from "@/lib/database.types";
import { revalidatePath } from "next/cache";

export async function getSiteSetting(key: string): Promise<SiteSetting | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("Error fetching site setting:", error);
    return null;
  }
  
  return data;
}

export async function updateSiteSetting(key: string, value: string) {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("site_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) throw error;
  
  revalidatePath("/");
  revalidatePath("/admin/crm");
}

export async function getActiveTestimonials(): Promise<Testimonial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching active testimonials:", error);
    return [];
  }
  
  return data;
}

export async function getAllTestimonials(): Promise<Testimonial[]> {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createTestimonial(data: TestimonialInsert) {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("testimonials")
    .insert(data);

  if (error) throw error;
  
  revalidatePath("/");
  revalidatePath("/admin/crm");
}

export async function updateTestimonial(id: string, data: TestimonialUpdate) {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("testimonials")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  
  revalidatePath("/");
  revalidatePath("/admin/crm");
}

export async function deleteTestimonial(id: string) {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("testimonials")
    .delete()
    .eq("id", id);

  if (error) throw error;
  
  revalidatePath("/");
  revalidatePath("/admin/crm");
}

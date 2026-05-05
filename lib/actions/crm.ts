"use server";

import { revalidatePath } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import { createClient } from "@/lib/supabase/server";
import type {
  SiteSetting,
  Testimonial,
  TestimonialInsert,
  TestimonialUpdate,
} from "@/lib/database.types";

const SITE_SETTING_DEFAULTS = {
  announcement_text: {
    description: "Text for announcement bar at the top of the page",
  },
  announcement_countdown_end_at: {
    description: "ISO date and time when the announcement countdown ends",
  },
  hero_image_url: {
    description: "Background image for the hero section",
  },
} as const;

type SiteSettingKey = keyof typeof SITE_SETTING_DEFAULTS;

function revalidateCmsPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/", "page");
  revalidatePath("/admin/crm", "page");
}

function normalizeSiteSettingKey(key: string): SiteSettingKey | null {
  return Object.prototype.hasOwnProperty.call(SITE_SETTING_DEFAULTS, key)
    ? (key as SiteSettingKey)
    : null;
}

function normalizeTestimonialInput(
  data: TestimonialInsert | TestimonialUpdate
): TestimonialUpdate {
  const normalized: TestimonialUpdate = {
    ...data,
  };

  if (typeof data.for_text === "string") {
    normalized.for_text = data.for_text.trim();
  }

  if (typeof data.quote === "string") {
    normalized.quote = data.quote.trim();
  }

  if (typeof data.initials === "string") {
    normalized.initials = data.initials.trim().toUpperCase().slice(0, 2);
  }

  if (typeof data.name === "string") {
    normalized.name = data.name.trim();
  }

  if (typeof data.location === "string") {
    normalized.location = data.location.trim();
  }

  if (data.sort_order !== undefined) {
    normalized.sort_order = Number.isFinite(Number(data.sort_order))
      ? Number(data.sort_order)
      : 0;
  }

  return normalized;
}

function assertCreatePayload(data: TestimonialUpdate): asserts data is TestimonialInsert {
  if (
    !data.for_text ||
    !data.quote ||
    !data.initials ||
    !data.name ||
    !data.location
  ) {
    throw new Error("All testimonial fields are required.");
  }
}

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

export async function updateSiteSetting(
  key: string,
  value: string
): Promise<SiteSetting> {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);

  const normalizedKey = normalizeSiteSettingKey(key);
  if (!normalizedKey) {
    throw new Error("Unsupported site setting key.");
  }

  const supabase = await createClient();
  const normalizedValue = value.trim();

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(
      {
        key: normalizedKey,
        value: normalizedValue,
        description: SITE_SETTING_DEFAULTS[normalizedKey].description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  revalidateCmsPaths();
  return data;
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

  if (error) {
    throw error;
  }

  return data;
}

export async function createTestimonial(
  data: TestimonialInsert
): Promise<Testimonial> {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  const normalizedData = normalizeTestimonialInput(data);

  assertCreatePayload(normalizedData);

  const { data: created, error } = await supabase
    .from("testimonials")
    .insert(normalizedData)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  revalidateCmsPaths();
  return created;
}

export async function updateTestimonial(
  id: string,
  data: TestimonialUpdate
): Promise<Testimonial> {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();
  const normalizedData = normalizeTestimonialInput(data);

  const { data: updated, error } = await supabase
    .from("testimonials")
    .update({
      ...normalizedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  revalidateCmsPaths();
  return updated;
}

export async function deleteTestimonial(id: string): Promise<boolean> {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);
  const supabase = await createClient();

  const { error } = await supabase
    .from("testimonials")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidateCmsPaths();
  return true;
}

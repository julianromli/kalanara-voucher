"use server";

import { revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Review, ReviewInsert } from "@/lib/database.types";

interface PublicReviewVoucherRow {
  id: string;
  services: {
    name: string;
    image_url: string | null;
  } | null;
}

interface PublicReviewVoucherPreview {
  service: {
    name: string;
    image: string;
  };
}

async function getPublicReviewVoucherRecordByCode(
  code: string
): Promise<PublicReviewVoucherRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("id, services(name, image_url)")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data || !data.services) {
    if (error && !("code" in error && error.code === "PGRST116")) {
      console.error("Error fetching public review voucher:", error);
    }

    return null;
  }

  return data as PublicReviewVoucherRow;
}

export async function getReviews(): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return (data as Review[]) || [];
}

export async function getReviewsByRating(minRating: number): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .gte("rating", minRating)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return (data as Review[]) || [];
}

export async function getAdminReviews(): Promise<Review[]> {
  await requireAdminPermission(AdminPermission.REVIEWS_MANAGE);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin reviews:", error);
    return [];
  }

  return (data as Review[]) || [];
}

export async function getPublicReviewVoucherByCode(
  code: string
): Promise<PublicReviewVoucherPreview | null> {
  const voucher = await getPublicReviewVoucherRecordByCode(code);
  if (!voucher) {
    return null;
  }

  const service = voucher.services;
  if (!service) {
    return null;
  }

  return {
    service: {
      name: service.name,
      image: service.image_url ?? "/images/services/placeholder.jpg",
    },
  };
}

export async function createPublicReview(
  voucherCode: string,
  review: Omit<ReviewInsert, "voucher_id">
): Promise<{ success: boolean; error?: string }> {
  const voucher = await getPublicReviewVoucherRecordByCode(voucherCode);
  if (!voucher) {
    return { success: false, error: "Voucher tidak ditemukan." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    voucher_id: voucher.id,
    rating: review.rating,
    comment: review.comment ?? null,
    customer_name: review.customer_name,
  });

  if (error) {
    console.error("Error creating public review:", error);
    return { success: false, error: "Gagal mengirim review. Silakan coba lagi." };
  }

  revalidateTag("dashboard-stats", "max");
  return { success: true };
}

export async function createReview(review: ReviewInsert): Promise<Review | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert(review)
    .select()
    .single();

  if (error) {
    console.error("Error creating review:", error);
    return null;
  }

  revalidateTag("dashboard-stats", "max");
  return data;
}

export async function deleteReview(id: string): Promise<boolean> {
  const access = await requireAdminPermission(AdminPermission.REVIEWS_MANAGE);

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id);

  if (!error) {
    logAdminAudit(access, {
      action: "review.delete",
      target: id,
    });

    revalidateTag("dashboard-stats", "max");
  }

  return !error;
}

export async function getAverageRating(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("rating");

  if (error || !data || data.length === 0) return 0;

  const sum = data.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / data.length) * 10) / 10;
}

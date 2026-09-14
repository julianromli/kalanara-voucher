"use server";

import { revalidateTag } from "next/cache";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import {
  logAdminAudit,
  requireAdminPermission,
} from "@/lib/auth/admin-rbac-server";
import {
  ADMIN_PAGE_SIZE,
  buildAdminPage,
  escapePostgrestLike,
  normalizeAdminListParams,
  type AdminListParams,
  type AdminPage,
} from "@/lib/actions/admin-pagination";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Review, ReviewInsert } from "@/lib/database.types";
import { resolveServiceImageUrl } from "@/lib/utils/serviceImages";

const REVIEW_ADMIN_LIST_SELECT =
  "id, rating, comment, customer_name";
const REVIEW_ADMIN_FILTERS = ["ALL", "1", "2", "3", "4", "5"] as const;

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

export async function getAdminReviewsPage(
  params: AdminListParams,
): Promise<AdminPage<Review>> {
  await requireAdminPermission(AdminPermission.REVIEWS_MANAGE);

  const normalized = normalizeAdminListParams(
    {
      page: String(params.page),
      query: params.query,
      filter: params.filter,
    },
    REVIEW_ADMIN_FILTERS,
  );
  const from = (normalized.page - 1) * ADMIN_PAGE_SIZE;
  const supabase = getAdminClient();
  let request = supabase
    .from("reviews")
    .select(REVIEW_ADMIN_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (normalized.filter !== "ALL") {
    request = request.eq("rating", Number(normalized.filter));
  }

  if (normalized.query) {
    const pattern = `"%${escapePostgrestLike(normalized.query)}%"`;
    request = request.or(
      `customer_name.ilike.${pattern},comment.ilike.${pattern}`,
    );
  }

  const firstResult = await request.range(
    from,
    from + ADMIN_PAGE_SIZE - 1,
  );

  if (firstResult.error) {
    console.error("Error fetching admin reviews:", firstResult.error);
    throw firstResult.error;
  }

  const firstPage = buildAdminPage(
    (firstResult.data as Review[]) ?? [],
    normalized.page,
    firstResult.count ?? 0,
  );
  if (firstPage.page === normalized.page || firstPage.totalCount === 0) {
    return firstPage;
  }

  const correctedFrom = (firstPage.page - 1) * ADMIN_PAGE_SIZE;
  const correctedResult = await request.range(
    correctedFrom,
    correctedFrom + ADMIN_PAGE_SIZE - 1,
  );
  if (correctedResult.error) {
    console.error(
      "Error fetching corrected reviews page:",
      correctedResult.error,
    );
    throw correctedResult.error;
  }

  return buildAdminPage(
    (correctedResult.data as Review[]) ?? [],
    firstPage.page,
    correctedResult.count ?? firstPage.totalCount,
  );
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
      image: resolveServiceImageUrl(service.image_url),
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

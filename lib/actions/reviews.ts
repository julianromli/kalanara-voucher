"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Review, ReviewInsert } from "@/lib/database.types";

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

  return data;
}

export async function deleteReview(id: string): Promise<boolean> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id);

  return !error;
}

export async function getAverageRating(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("rating");

  if (error || !data || data.length === 0) return 0;

  const sum = data.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / data.length) * 10) / 10;
}

"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  getServiceImageBucket,
  getServiceImageObjectPath,
  isSupabaseServiceImageUrl,
} from "@/lib/utils/serviceImages";

export async function deleteServiceImageByUrl(imageUrl: string | null | undefined) {
  if (!isSupabaseServiceImageUrl(imageUrl)) {
    return { success: true };
  }

  const objectPath = getServiceImageObjectPath(imageUrl);

  if (!objectPath) {
    return { success: false, error: "Invalid storage image URL." };
  }

  const supabase = getAdminClient();
  const { error } = await supabase.storage
    .from(getServiceImageBucket())
    .remove([objectPath]);

  if (error) {
    console.error("Error deleting service image:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

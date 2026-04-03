"use server";

import { UTApi } from "uploadthing/server";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getUploadThingFileKey,
  getServiceImageBucket,
  getServiceImageObjectPath,
  isUploadThingServiceImageUrl,
  isSupabaseServiceImageUrl,
} from "@/lib/utils/serviceImages";

const utapi = new UTApi();

export async function deleteServiceImageByUrl(imageUrl: string | null | undefined) {
  await requireAdminPermission(AdminPermission.SERVICE_IMAGES_MANAGE);

  if (!imageUrl) {
    return { success: true };
  }

  if (isUploadThingServiceImageUrl(imageUrl)) {
    const fileKey = getUploadThingFileKey(imageUrl);

    if (!fileKey) {
      return { success: false, error: "Invalid UploadThing image URL." };
    }

    try {
      await utapi.deleteFiles(fileKey);
      return { success: true };
    } catch (error) {
      console.error("Error deleting UploadThing service image:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete image.",
      };
    }
  }

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

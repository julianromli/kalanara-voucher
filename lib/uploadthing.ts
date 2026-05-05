import { getMaxServiceImageSizeBytes } from "@/lib/utils/serviceImages";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi, UploadThingError } from "uploadthing/server";
import { getCurrentAdminAccess } from "@/lib/auth/admin-rbac-server";

const f = createUploadthing();

export const utapi = new UTApi();

export const uploadRouter = {
  serviceImageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ files }) => {
      const access = await getCurrentAdminAccess();

      if (!access || access.role !== "SUPER_ADMIN") {
        throw new UploadThingError("Unauthorized");
      }

      if (files.some((file) => file.size > getMaxServiceImageSizeBytes())) {
        throw new UploadThingError("Ukuran gambar maksimal 5MB.");
      }

      return {
        uploadedBy: access.userId,
      };
    })
    .onUploadComplete(async ({ file, metadata }) => ({
      uploadedBy: metadata.uploadedBy,
      imageUrl: file.ufsUrl,
      fileKey: file.key,
    })),
  heroImageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ files }) => {
      const access = await getCurrentAdminAccess();

      if (!access || !access.permissions.includes("crm.manage")) {
        throw new UploadThingError("Unauthorized");
      }

      if (files.some((file) => file.size > 8 * 1024 * 1024)) {
        throw new UploadThingError("Ukuran gambar maksimal 8MB.");
      }

      return {
        uploadedBy: access.userId,
      };
    })
    .onUploadComplete(async ({ file, metadata }) => ({
      uploadedBy: metadata.uploadedBy,
      imageUrl: file.ufsUrl,
      fileKey: file.key,
    })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;

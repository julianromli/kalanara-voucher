import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPermissionMock,
  getAdminClientMock,
  storageFromMock,
  removeMock,
  deleteFilesMock,
} = vi.hoisted(() => ({
  requireAdminPermissionMock: vi.fn(),
  getAdminClientMock: vi.fn(),
  storageFromMock: vi.fn(),
  removeMock: vi.fn(),
  deleteFilesMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-rbac-server", () => ({
  requireAdminPermission: requireAdminPermissionMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: getAdminClientMock,
}));

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = deleteFilesMock;
  },
}));

import { deleteServiceImageByUrl } from "@/lib/actions/service-images";
import { AdminPermission } from "@/lib/auth/admin-rbac";

describe("deleteServiceImageByUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    removeMock.mockResolvedValue({ error: null });
    storageFromMock.mockReturnValue({
      remove: removeMock,
    });
    getAdminClientMock.mockReturnValue({
      storage: {
        from: storageFromMock,
      },
    });
    deleteFilesMock.mockResolvedValue({ success: true, deletedCount: 1 });
  });

  it("requires super-admin-only service image permission", async () => {
    await deleteServiceImageByUrl("https://app-id.ufs.sh/f/service-image-key.webp");

    expect(requireAdminPermissionMock).toHaveBeenCalledWith(
      AdminPermission.SERVICE_IMAGES_MANAGE
    );
  });

  it("deletes UploadThing-managed images by file key", async () => {
    const result = await deleteServiceImageByUrl(
      "https://app-id.ufs.sh/f/service-image-key.webp"
    );

    expect(deleteFilesMock).toHaveBeenCalledWith("service-image-key.webp");
    expect(removeMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("deletes legacy Supabase-managed images by object path", async () => {
    const result = await deleteServiceImageByUrl(
      "https://example.supabase.co/storage/v1/object/public/services/services/service-123/photo.webp"
    );

    expect(storageFromMock).toHaveBeenCalledWith("services");
    expect(removeMock).toHaveBeenCalledWith(["services/service-123/photo.webp"]);
    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("ignores unmanaged external image URLs", async () => {
    const result = await deleteServiceImageByUrl("https://images.unsplash.com/photo-1");

    expect(deleteFilesMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

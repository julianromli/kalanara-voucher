"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit01Icon,
  Delete02Icon,
  Clock01Icon,
  Cancel01Icon,
  Tick02Icon,
  Loading03Icon,
  Search01Icon,
  FilterIcon,
  Tag01Icon,
  Upload04Icon,
  ImageDelete01Icon,
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { deleteServiceImageByUrl } from "@/lib/actions/service-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  createService,
  updateService,
  deleteService,
} from "@/lib/actions/services";
import type { Service, ServiceInsert, ServiceUpdate } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import {
  buildServiceImagePath,
  getAllowedServiceImageTypes,
  getMaxServiceImageSizeBytes,
  getServiceImageBucket,
} from "@/lib/utils/serviceImages";

type ServiceCategory = "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";
type UploadStatus = "idle" | "uploading" | "error";

interface ServiceFormData {
  name: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MASSAGE: "Massage",
  FACIAL: "Facial",
  BODY_TREATMENT: "Body Treatment",
  PACKAGE: "Package",
};

const DEFAULT_FORM: ServiceFormData = {
  name: "",
  description: "",
  duration: 60,
  price: 500000,
  category: "MASSAGE",
};

const FALLBACK_SERVICE_IMAGE =
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80";

const MAX_IMAGE_SIZE_MB = Math.floor(getMaxServiceImageSizeBytes() / (1024 * 1024));

interface ServicesClientProps {
  initialServices: Service[];
}

function createDraftScopeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft/${crypto.randomUUID()}`;
  }

  return `draft/${Date.now()}`;
}

export function ServicesClient({ initialServices }: ServicesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>(initialServices);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "ALL">("ALL");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const resetImageState = (imageUrl = "") => {
    setSelectedImageFile(null);
    setImagePreviewUrl(imageUrl);
    setOriginalImageUrl(imageUrl);
    setRemoveCurrentImage(false);
    setUploadStatus("idle");
    setUploadError(null);
    setFileInputKey((prev) => prev + 1);
  };

  const setOptimistic = (id: string, active: boolean) => {
    setOptimisticIds((prev) => {
      const next = new Set(prev);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!imagePreviewUrl.startsWith("blob:")) {
      return;
    }

    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "ALL" || service.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenCreate = () => {
    setFormData(DEFAULT_FORM);
    resetImageState();
    setIsEditing(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: service.price,
      category: service.category,
    });
    resetImageState(service.image_url || "");
    setIsEditing(true);
    setEditingId(service.id);
    setIsDialogOpen(true);
  };

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = getAllowedServiceImageTypes();
    if (!allowedTypes.includes(file.type as (typeof allowedTypes)[number])) {
      setUploadStatus("error");
      setUploadError("Please select a JPG, PNG, or WebP image.");
      showToast("Please select a JPG, PNG, or WebP image.", "error");
      return;
    }

    if (file.size > getMaxServiceImageSizeBytes()) {
      setUploadStatus("error");
      setUploadError(`Image size must be ${MAX_IMAGE_SIZE_MB}MB or smaller.`);
      showToast(`Image size must be ${MAX_IMAGE_SIZE_MB}MB or smaller.`, "error");
      return;
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setRemoveCurrentImage(false);
    setUploadStatus("idle");
    setUploadError(null);
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl("");
    setRemoveCurrentImage(true);
    setUploadStatus("idle");
    setUploadError(null);
    setFileInputKey((prev) => prev + 1);
  };

  const uploadImageIfNeeded = async () => {
    if (!selectedImageFile) {
      return { uploadedImageUrl: null as string | null };
    }

    setUploadStatus("uploading");
    setUploadError(null);

    const supabase = createClient();
    const scopeId = editingId ? `services/${editingId}` : `services/${createDraftScopeId()}`;
    const objectPath = buildServiceImagePath(scopeId, selectedImageFile.name);
    const { data, error } = await supabase.storage
      .from(getServiceImageBucket())
      .upload(objectPath, selectedImageFile, {
        cacheControl: "31536000",
        contentType: selectedImageFile.type,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(getServiceImageBucket())
      .getPublicUrl(data.path);

    setUploadStatus("idle");
    return { uploadedImageUrl: publicUrlData.publicUrl };
  };

  const cleanupImage = async (imageUrl: string | null) => {
    if (!imageUrl) {
      return;
    }

    const result = await deleteServiceImageByUrl(imageUrl);

    if (!result.success) {
      throw new Error(result.error || "Failed to delete service image.");
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      showToast("Please fill in required fields", "error");
      return;
    }

    if (uploadStatus === "uploading") {
      return;
    }

    setIsSaving(true);

    let uploadedImageUrl: string | null = null;
    let nextImageUrl: string | null = removeCurrentImage ? null : originalImageUrl || null;

    try {
      if (selectedImageFile) {
        const uploaded = await uploadImageIfNeeded();
        uploadedImageUrl = uploaded.uploadedImageUrl;
        nextImageUrl = uploaded.uploadedImageUrl;
      }

      if (isEditing && editingId) {
        const previous = services;
        const optimisticUpdated = services.map((service) =>
          service.id === editingId
            ? {
                ...service,
                name: formData.name,
                description: formData.description || null,
                duration: formData.duration,
                price: formData.price,
                category: formData.category,
                image_url: nextImageUrl,
                updated_at: new Date().toISOString(),
              }
            : service
        );

        setServices(optimisticUpdated);
        setOptimistic(editingId, true);

        try {
          const updated = await updateService(editingId, {
            name: formData.name,
            description: formData.description || null,
            duration: formData.duration,
            price: formData.price,
            category: formData.category,
            image_url: nextImageUrl,
          } as ServiceUpdate);

          if (!updated) {
            throw new Error("Failed to update");
          }

          setServices((prev) => prev.map((service) => (service.id === editingId ? updated : service)));
          setIsDialogOpen(false);
          resetImageState(updated.image_url || "");
          showToast("Service updated successfully", "success");

          if (originalImageUrl && originalImageUrl !== nextImageUrl) {
            try {
              await cleanupImage(originalImageUrl);
            } catch (error) {
              console.error(error);
              showToast("Service updated, but old image cleanup failed", "error");
            }
          }
        } catch (error) {
          setServices(previous);

          if (uploadedImageUrl) {
            await cleanupImage(uploadedImageUrl).catch((cleanupError) => {
              console.error(cleanupError);
            });
          }

          throw error;
        } finally {
          setOptimistic(editingId, false);
        }

        return;
      }

      const tempId = `temp-${Date.now()}`;
      const previous = services;
      const optimisticService: Service = {
        id: tempId,
        name: formData.name,
        description: formData.description || null,
        duration: formData.duration,
        price: formData.price,
        category: formData.category,
        image_url: nextImageUrl,
        is_active: true,
        scalev_product_id: null,
        scalev_variant_id: null,
        scalev_variant_unique_id: null,
        scalev_sync_status: null,
        scalev_last_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setServices((prev) => [...prev, optimisticService]);
      setOptimistic(tempId, true);

      try {
        const created = await createService({
          name: formData.name,
          description: formData.description || null,
          duration: formData.duration,
          price: formData.price,
          category: formData.category,
          image_url: nextImageUrl,
        } as ServiceInsert);

        if (!created) {
          throw new Error("Failed to create");
        }

        setServices((prev) => prev.map((service) => (service.id === tempId ? created : service)));
        setIsDialogOpen(false);
        resetImageState(created.image_url || "");
        setFormData(DEFAULT_FORM);
        showToast("Service created successfully", "success");
      } catch (error) {
        setServices(previous);

        if (uploadedImageUrl) {
          await cleanupImage(uploadedImageUrl).catch((cleanupError) => {
            console.error(cleanupError);
          });
        }

        throw error;
      } finally {
        setOptimistic(tempId, false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save service";
      setUploadStatus(selectedImageFile ? "error" : "idle");
      setUploadError(selectedImageFile ? message : null);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    setOptimistic(id, true);
    const previous = services;

    setServices((prev) => prev.filter((service) => service.id !== id));

    try {
      const success = await deleteService(id);
      if (success) {
        showToast("Service deactivated", "success");
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      setServices(previous);
      showToast("Failed to delete service", "error");
    } finally {
      setIsDeleting(null);
      setOptimistic(id, false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const isBusy = isSaving || uploadStatus === "uploading";

  return (
    <>
      <DashboardHeader title="Service Management" showActions={false} />
      <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4 md:p-6">
        <div
          className={cn(
            "mb-6 flex items-center justify-between",
            isMounted ? "animate-fade-slide-down" : "opacity-0"
          )}
        >
          <p className="text-sm text-muted-foreground">
            Manage spa services, pricing, and availability
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="btn-hover-lift">
            <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
            Add Service
          </Button>
        </div>

        <div
          className={cn(
            "mb-6 rounded-2xl border border-border bg-card p-4 shadow-spa",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as ServiceCategory | "ALL")}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <HugeiconsIcon icon={FilterIcon} size={16} className="mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-spa">
            <HugeiconsIcon icon={Tag01Icon} size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-muted-foreground">
              No services found
            </h3>
            <p className="mb-6 text-muted-foreground">
              {searchQuery || categoryFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Create your first service to get started"}
            </p>
            {!searchQuery && categoryFilter === "ALL" && (
              <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90">
                <HugeiconsIcon icon={PlusSignIcon} size={18} className="mr-2" />
                Create Service
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service, index) => {
              const isOptimistic = optimisticIds.has(service.id);
              return (
                <div
                  key={service.id}
                  className={cn(
                    "card-hover-lift overflow-hidden rounded-2xl border border-border bg-card shadow-spa transition-all hover:shadow-spa-lg",
                    !service.is_active && "opacity-60",
                    isOptimistic && "opacity-70 saturate-50",
                    isMounted ? "animate-fade-slide-up" : "opacity-0"
                  )}
                  style={{ animationDelay: `${200 + index * 75}ms` }}
                >
                  <div className="relative h-40">
                    <Image
                      src={service.image_url || FALLBACK_SERVICE_IMAGE}
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute right-3 top-3 flex gap-2">
                      {isOptimistic && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                          <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                          Syncing
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs",
                          service.is_active
                            ? "bg-primary text-primary-foreground"
                            : "bg-destructive text-destructive-foreground"
                        )}
                      >
                        {service.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-full bg-card/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
                        {CATEGORY_LABELS[service.category]}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="mb-1 font-sans text-xl font-semibold text-foreground">
                      {service.name}
                    </h3>
                    <p className="mb-4 min-h-[40px] line-clamp-2 text-sm text-muted-foreground">
                      {service.description || "No description"}
                    </p>

                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} size={16} />
                        <span className="text-sm">{service.duration} mins</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(service.price)}
                      </span>
                    </div>

                    <div className="flex gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        onClick={() => handleOpenEdit(service)}
                        disabled={isOptimistic}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(service.id)}
                        disabled={isDeleting === service.id || isOptimistic}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isDeleting === service.id ? (
                          <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
                        ) : (
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl font-semibold">
              {isEditing ? "Edit Service" : "Create New Service"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">
                Service Name *
              </label>
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g., Balinese Massage"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Describe the service..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">
                  Duration (mins) *
                </label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={formData.duration}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: parseInt(event.target.value, 10) || 60,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">
                  Price (IDR) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={50000}
                  value={formData.price}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      price: parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">
                Category *
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value as ServiceCategory }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-muted-foreground">
                  Service Image
                </label>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, WebP up to {MAX_IMAGE_SIZE_MB}MB
                </span>
              </div>

              <Input
                key={fileInputKey}
                type="file"
                accept={getAllowedServiceImageTypes().join(",")}
                onChange={handleSelectImage}
                disabled={isBusy}
              />

              <div className="overflow-hidden rounded-xl border border-dashed border-border bg-muted/20">
                {imagePreviewUrl ? (
                  <div className="relative h-40">
                    <Image
                      src={imagePreviewUrl}
                      alt="Service preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 512px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={Upload04Icon} size={24} />
                    <span>No image selected</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveImage}
                  disabled={isBusy || (!imagePreviewUrl && !originalImageUrl)}
                >
                  <HugeiconsIcon icon={ImageDelete01Icon} size={16} className="mr-2" />
                  Remove Image
                </Button>
                {uploadStatus === "uploading" && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
                    Uploading image...
                  </span>
                )}
              </div>

              {removeCurrentImage && !selectedImageFile && (
                <p className="text-sm text-muted-foreground">
                  The current image will be removed when you save this service.
                </p>
              )}

              {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isBusy}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isBusy}
              className="bg-primary hover:bg-primary/90"
            >
              {isBusy ? (
                <HugeiconsIcon icon={Loading03Icon} size={16} className="mr-1 animate-spin" />
              ) : (
                <HugeiconsIcon icon={Tick02Icon} size={16} className="mr-1" />
              )}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

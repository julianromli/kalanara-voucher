"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  PencilEdit01Icon,
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
import { ChevronDown, ChevronUp, Edit2, Trash2, FolderOpen, EyeOff, Eye, Loader2, Plus } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  createService,
  updateService,
  setServiceActiveState,
} from "@/lib/actions/services";
import {
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
} from "@/lib/actions/service-categories";
import type { Database, ServiceInsert, ServiceUpdate } from "@/lib/database.types";
import type { ServiceWithCategory } from "@/lib/actions/services";
import { cn } from "@/lib/utils";
import {
  buildServiceImagePath,
  getAllowedServiceImageTypes,
  getMaxServiceImageSizeBytes,
  getServiceImageBucket,
} from "@/lib/utils/serviceImages";

type ServiceCategoryRow = Database["public"]["Tables"]["service_categories"]["Row"];
type UploadStatus = "idle" | "uploading" | "error";

interface ServiceFormData {
  name: string;
  description: string;
  duration: number;
  price: number;
  category_id: string;
}

const DEFAULT_FORM: ServiceFormData = {
  name: "",
  description: "",
  duration: 60,
  price: 500000,
  category_id: "",
};

const FALLBACK_SERVICE_IMAGE =
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80";

const MAX_IMAGE_SIZE_MB = Math.floor(getMaxServiceImageSizeBytes() / (1024 * 1024));

interface ServicesClientProps {
  initialServices: ServiceWithCategory[];
  initialCategories: ServiceCategoryRow[];
}

function createDraftScopeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft/${crypto.randomUUID()}`;
  }
  return `draft/${Date.now()}`;
}


function getLegacyCategoryForSlug(slug?: string | null): "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE" | null {
  if (!slug) return null;
  switch (slug) {
    case "massage": return "MASSAGE";
    case "facial": return "FACIAL";
    case "body-treatment": return "BODY_TREATMENT";
    case "package": return "PACKAGE";
    default: return null;
  }
}

export function ServicesClient({ initialServices, initialCategories }: ServicesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  
  const searchInputId = useId();
  const categoryFilterId = useId();
  const serviceNameId = useId();
  const serviceDescriptionId = useId();
  const serviceDurationId = useId();
  const servicePriceId = useId();
  const serviceCategoryId = useId();
  const serviceImageId = useId();
  const uploadErrorId = useId();

  const [services, setServices] = useState<ServiceWithCategory[]>(initialServices);
  const [categories, setCategories] = useState<ServiceCategoryRow[]>(initialCategories);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Service form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  
  // Category form state
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [isCatBusy, setIsCatBusy] = useState(false);

  // Layout & sync state
  const [isMounted, setIsMounted] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  
  // Upload state
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
      categoryFilter === "ALL" 
        ? true 
        : categoryFilter === "LEGACY" 
          ? !service.category_id 
          : service.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenCreate = () => {
    setFormData(DEFAULT_FORM);
    resetImageState();
    setIsEditing(false);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (service: ServiceWithCategory) => {
    setFormData({
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: service.price,
      category_id: service.category_id || "",
    });
    resetImageState(service.image_url || "");
    setIsEditing(true);
    setEditingId(service.id);
    setIsDialogOpen(true);
  };

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = getAllowedServiceImageTypes();
    if (!allowedTypes.includes(file.type as (typeof allowedTypes)[number])) {
      setUploadStatus("error");
      setUploadError("Silakan pilih gambar JPG, PNG, atau WebP.");
      showToast("Silakan pilih gambar JPG, PNG, atau WebP.", "error");
      return;
    }

    if (file.size > getMaxServiceImageSizeBytes()) {
      setUploadStatus("error");
      setUploadError(`Ukuran gambar maksimal ${MAX_IMAGE_SIZE_MB}MB.`);
      showToast(`Ukuran gambar maksimal ${MAX_IMAGE_SIZE_MB}MB.`, "error");
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
    if (!imageUrl) return;
    const result = await deleteServiceImageByUrl(imageUrl);
    if (!result.success) {
      throw new Error(result.error || "Gagal menghapus gambar layanan.");
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      showToast("Mohon lengkapi field wajib.", "error");
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
                category_id: formData.category_id || null,
                category_relation: categories.find(c => c.id === formData.category_id) || service.category_relation,
                image_url: nextImageUrl,
                updated_at: new Date().toISOString(),
              }
            : service
        );

        setServices(optimisticUpdated);
        setOptimistic(editingId, true);

        try {
          const selectedCategory = categories.find(c => c.id === formData.category_id);
          const previousService = previous.find(s => s.id === editingId);
          const mappedLegacy = getLegacyCategoryForSlug(selectedCategory?.slug);
          
          // CRITICAL: For custom categories (mappedLegacy is null), we MUST preserve the 
          // existing service's legacy category. The database trigger sync_service_category_id_from_legacy
          // overwrites category_id if the legacy category changes. Preserving it prevents this.
          const legacyCategory = mappedLegacy || previousService?.category || "MASSAGE";

          const updated = await updateService(editingId, {
            name: formData.name,
            description: formData.description || null,
            duration: formData.duration,
            price: formData.price,
            category: legacyCategory,
            category_id: formData.category_id || null,
            image_url: nextImageUrl,
          } as ServiceUpdate);

          if (!updated) {
            throw new Error("Gagal memperbarui layanan.");
          }

          setServices((prev) => prev.map((service) => (service.id === editingId ? updated : service)));
          setIsDialogOpen(false);
          resetImageState(updated.image_url || "");
          showToast("Layanan berhasil diperbarui.", "success");

          if (originalImageUrl && originalImageUrl !== nextImageUrl) {
            try {
              await cleanupImage(originalImageUrl);
            } catch (error) {
              console.error(error);
              showToast("Layanan diperbarui, tetapi gambar lama gagal dihapus.", "error");
            }
          }
        } catch (error) {
          setServices(previous);
          if (uploadedImageUrl) {
            await cleanupImage(uploadedImageUrl).catch(console.error);
          }
          throw error;
        } finally {
          setOptimistic(editingId, false);
        }
        return;
      }

      const tempId = `temp-${Date.now()}`;
      const previous = services;
      const optimisticService: ServiceWithCategory = {
        id: tempId,
        name: formData.name,
        description: formData.description || null,
        duration: formData.duration,
        price: formData.price,
        category: getLegacyCategoryForSlug(categories.find(c => c.id === formData.category_id)?.slug) || "MASSAGE",
        category_id: formData.category_id || null,
        category_relation: categories.find(c => c.id === formData.category_id) || null,
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
          category: getLegacyCategoryForSlug(categories.find(c => c.id === formData.category_id)?.slug) || "MASSAGE",
          category_id: formData.category_id || null,
          image_url: nextImageUrl,
        } as ServiceInsert);

        if (!created) {
          throw new Error("Gagal membuat layanan.");
        }

        setServices((prev) => prev.map((service) => (service.id === tempId ? created : service)));
        setIsDialogOpen(false);
        resetImageState(created.image_url || "");
        setFormData(DEFAULT_FORM);
        showToast("Layanan berhasil dibuat.", "success");
      } catch (error) {
        setServices(previous);
        if (uploadedImageUrl) {
          await cleanupImage(uploadedImageUrl).catch(console.error);
        }
        throw error;
      } finally {
        setOptimistic(tempId, false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan layanan.";
      setUploadStatus(selectedImageFile ? "error" : "idle");
      setUploadError(selectedImageFile ? message : null);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleService = async (service: ServiceWithCategory) => {
    setStatusUpdatingId(service.id);
    setOptimistic(service.id, true);
    const previous = services;
    const nextIsActive = !service.is_active;

    setServices((prev) =>
      prev.map((item) =>
        item.id === service.id
          ? {
              ...item,
              is_active: nextIsActive,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    try {
      const updated = await setServiceActiveState(service.id, nextIsActive);
      if (!updated) {
        throw new Error("Gagal mengubah status layanan.");
      }

      setServices((prev) => prev.map((item) => (item.id === service.id ? updated : item)));
      showToast(
        nextIsActive ? "Layanan berhasil diaktifkan." : "Layanan berhasil dinonaktifkan.",
        "success"
      );
    } catch {
      setServices(previous);
      showToast("Gagal mengubah status layanan.", "error");
    } finally {
      setStatusUpdatingId(null);
      setOptimistic(service.id, false);
    }
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    setIsCatBusy(true);
    try {
      if (editingCatId) {
        const updated = await updateServiceCategory(editingCatId, { name: catName });
        setCategories((prev) => prev.map((c) => (c.id === editingCatId ? updated : c)));
        
        // Update optimistic relations in services list
        setServices(prev => prev.map(s => {
          if (s.category_id === updated.id) {
            return { ...s, category_relation: updated };
          }
          return s;
        }));
        
        showToast("Kategori berhasil diperbarui", "success");
      } else {
        const created = await createServiceCategory({ name: catName, isActive: true });
        setCategories((prev) => [...prev, created]);
        showToast("Kategori berhasil ditambahkan", "success");
      }
      setIsCatDialogOpen(false);
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan kategori", "error");
    } finally {
      setIsCatBusy(false);
    }
  };

  const handleToggleCategory = async (category: ServiceCategoryRow) => {
    try {
      const updated = await updateServiceCategory(category.id, { 
        name: category.name, 
        isActive: !category.is_active 
      });
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      
      // Update optimistic relations in services list
      setServices(prev => prev.map(s => {
        if (s.category_id === updated.id) {
          return { ...s, category_relation: updated };
        }
        return s;
      }));
      
      showToast(`Kategori ${updated.is_active ? 'diaktifkan' : 'dinonaktifkan'}`, "success");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status kategori", "error");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus kategori ini?")) return;
    
    try {
      await deleteServiceCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (categoryFilter === id) setCategoryFilter("ALL");
      showToast("Kategori berhasil dihapus", "success");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus kategori", "error");
    }
  };

  if (!isAuthenticated && !authLoading) {
    return null;
  }

  const isBusy = isSaving || uploadStatus === "uploading";

  return (
    <main aria-labelledby="services-page-title" className="contents">
      <DashboardHeader title="Manajemen Layanan" showActions={false} />
      <div className="h-full w-full overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 md:px-6">
        <div
          className={cn(
            "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            isMounted ? "animate-fade-slide-down" : "opacity-0"
          )}
        >
          <div className="min-w-0">
            <h2 id="services-page-title" className="text-lg font-semibold text-foreground sm:text-xl">
              Kelola layanan spa
            </h2>
            <p className="text-sm text-muted-foreground">
              Kelola layanan spa, harga, dan ketersediaannya
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="btn-hover-lift min-h-11 w-full sm:w-auto"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
            Tambah Layanan
          </Button>
        </div>

        {/* Category Management Block */}
        <Collapsible
          open={isCategoriesOpen}
          onOpenChange={setIsCategoriesOpen}
          className={cn(
            "mb-6 rounded-2xl border border-border bg-card shadow-spa transition-all",
            isMounted ? "animate-fade-slide-down" : "opacity-0"
          )}
          style={{ animationDelay: "50ms" }}
        >
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Kelola Kategori</h3>
                <p className="text-sm text-muted-foreground">Tambah, ubah, atau nonaktifkan kategori layanan.</p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isCategoriesOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="sr-only">Buka atau tutup kategori</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="border-t border-border p-4 sm:p-5">
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCatId(null);
                    setCatName("");
                    setIsCatDialogOpen(true);
                  }}
                  className="btn-hover-lift h-9"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Kategori
                </Button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Nama Kategori</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[150px] text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          Belum ada kategori kustom.
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell className="font-medium text-foreground">{cat.name}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs",
                                cat.is_active
                                  ? "bg-primary/10 text-primary"
                                  : "bg-destructive/10 text-destructive"
                              )}
                            >
                              {cat.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleToggleCategory(cat)}
                                title={cat.is_active ? "Nonaktifkan" : "Aktifkan"}
                              >
                                {cat.is_active ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setCatName(cat.name);
                                  setIsCatDialogOpen(true);
                                }}
                                title="Edit Kategori"
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeleteCategory(cat.id)}
                                title="Hapus Kategori"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div
          className={cn(
            "mb-6 rounded-2xl border border-border bg-card p-4 shadow-spa sm:p-5",
            isMounted ? "animate-fade-slide-up" : "opacity-0"
          )}
            style={{ animationDelay: "100ms" }}
          >
          <form
            aria-label="Filter layanan"
            className="flex flex-col gap-4 lg:flex-row lg:items-end"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="flex-1 space-y-2">
              <label htmlFor={searchInputId} className="text-sm font-medium text-foreground">
                Cari layanan
              </label>
              <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchInputId}
                placeholder="Cari layanan..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-describedby="services-results-status"
                className="h-11 pl-10"
              />
            </div>
            </div>

            <div className="space-y-2 lg:w-[240px]">
              <label htmlFor={categoryFilterId} className="text-sm font-medium text-foreground">
                Category
              </label>
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value)}
              >
                <SelectTrigger id={categoryFilterId} aria-label="Filter berdasarkan kategori" className="min-h-11 w-full">
                <HugeiconsIcon icon={FilterIcon} size={16} className="mr-2" />
                <SelectValue placeholder="Semua kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kategori</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="LEGACY">Lainnya (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p
              id="services-results-status"
              className="text-sm text-muted-foreground lg:min-w-[180px] lg:text-right"
              aria-live="polite"
            >
              {filteredServices.length} layanan ditampilkan
            </p>
          </form>
        </div>

        {filteredServices.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-spa sm:px-8 sm:py-12"
          >
            <HugeiconsIcon icon={Tag01Icon} size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Tidak ada layanan ditemukan
            </h3>
            <p className="mb-6 text-muted-foreground">
              {searchQuery || categoryFilter !== "ALL"
                ? "Coba sesuaikan kata kunci atau filter Anda"
                : "Buat layanan pertama Anda untuk memulai"}
            </p>
            {!searchQuery && categoryFilter === "ALL" && (
              <Button onClick={handleOpenCreate} className="min-h-11 bg-primary hover:bg-primary/90">
                <HugeiconsIcon icon={PlusSignIcon} size={18} className="mr-2" />
                Buat Layanan
              </Button>
            )}
          </div>
        ) : (
          <section aria-label="Daftar layanan" aria-busy={isBusy}>
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service, index) => {
              const isOptimistic = optimisticIds.has(service.id);
              const badgeLabel = service.category_relation?.name || "Layanan";
              
              return (
                <article
                  key={service.id}
                  className={cn(
                    "card-hover-lift overflow-hidden rounded-2xl border border-border bg-card shadow-spa transition-all duration-200 hover:shadow-spa-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    !service.is_active && "opacity-60",
                    isOptimistic && "opacity-70 saturate-50",
                    isMounted ? "animate-fade-slide-up" : "opacity-0"
                  )}
                  style={{ animationDelay: `${200 + index * 75}ms` }}
                  aria-labelledby={`service-name-${service.id}`}
                >
                  <div className="relative h-44 sm:h-40">
                    <Image
                      src={service.image_url || FALLBACK_SERVICE_IMAGE}
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
                      {isOptimistic && (
                        <span
                          className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                          aria-live="polite"
                        >
                          <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                          Menyinkronkan
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
                        {service.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded-full bg-card/95 px-2 py-1 text-xs font-medium text-foreground backdrop-blur">
                        {badgeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <h3 id={`service-name-${service.id}`} className="mb-1 font-sans text-lg font-semibold text-foreground sm:text-xl">
                      {service.name}
                    </h3>
                    <p className="mb-4 min-h-[40px] line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {service.description || "Tidak ada deskripsi"}
                    </p>

                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} size={16} />
                        <span className="text-sm">{service.duration} menit</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(service.price)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                      <Button
                        onClick={() => handleOpenEdit(service)}
                        disabled={isOptimistic}
                        className="min-h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        aria-label={`Ubah ${service.name}`}
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={14} className="mr-1" />
                        Ubah
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleToggleService(service)}
                        disabled={statusUpdatingId === service.id || isOptimistic}
                        className={cn(
                          "min-h-11 flex-1",
                          service.is_active
                            ? "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            : "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                        )}
                        aria-label={`${service.is_active ? "Nonaktifkan" : "Aktifkan"} ${service.name}`}
                      >
                        {statusUpdatingId === service.id ? (
                          <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
                        ) : service.is_active ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Nonaktifkan
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Aktifkan
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          </section>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl font-semibold">
              {isEditing ? "Ubah Layanan" : "Tambah Layanan Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label htmlFor={serviceNameId} className="mb-1.5 block text-sm font-medium text-foreground">
                Nama Layanan *
              </label>
              <Input
                id={serviceNameId}
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Misal: Balinese Massage"
                className="min-h-11"
                aria-required="true"
              />
            </div>

            <div>
              <label
                htmlFor={serviceDescriptionId}
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Deskripsi
              </label>
              <textarea
                id={serviceDescriptionId}
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Tulis deskripsi layanan..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={serviceDurationId} className="mb-1.5 block text-sm font-medium text-foreground">
                  Durasi (menit) *
                </label>
                <Input
                  id={serviceDurationId}
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
                  className="min-h-11"
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor={servicePriceId} className="mb-1.5 block text-sm font-medium text-foreground">
                  Price (IDR) *
                </label>
                <Input
                  id={servicePriceId}
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
                  className="min-h-11"
                  aria-required="true"
                />
              </div>
            </div>

            <div>
              <label htmlFor={serviceCategoryId} className="mb-1.5 block text-sm font-medium text-foreground">
                Kategori *
              </label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category_id: value }))
                }
              >
                <SelectTrigger id={serviceCategoryId} className="min-h-11" aria-required="true">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.is_active || c.id === formData.category_id)
                    .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} {!cat.is_active && "(Nonaktif)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor={serviceImageId} className="block text-sm font-medium text-foreground">
                  Gambar Layanan
                </label>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, WebP hingga {MAX_IMAGE_SIZE_MB}MB
                </span>
              </div>

              <Input
                id={serviceImageId}
                key={fileInputKey}
                type="file"
                accept={getAllowedServiceImageTypes().join(",")}
                onChange={handleSelectImage}
                disabled={isBusy}
                className="min-h-11"
                aria-describedby={uploadError ? uploadErrorId : undefined}
              />

              <div className="overflow-hidden rounded-xl border border-dashed border-border bg-muted/20">
                {imagePreviewUrl ? (
                  <div className="relative h-40">
                    <Image
                      src={imagePreviewUrl}
                      alt="Pratinjau layanan"
                      fill
                      sizes="(max-width: 768px) 100vw, 512px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <HugeiconsIcon icon={Upload04Icon} size={24} />
                    <span>Belum ada gambar dipilih</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveImage}
                  disabled={isBusy || (!imagePreviewUrl && !originalImageUrl)}
                  className="min-h-11 w-full sm:w-auto"
                >
                  <HugeiconsIcon icon={ImageDelete01Icon} size={16} className="mr-2" />
                  Hapus Gambar
                </Button>
                {uploadStatus === "uploading" && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                    <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
                    Mengunggah gambar...
                  </span>
                )}
              </div>

              {removeCurrentImage && !selectedImageFile && (
                <p className="text-sm text-muted-foreground">
                  Gambar saat ini akan dihapus ketika Anda menyimpan layanan ini.
                </p>
              )}

              {uploadError && (
                <p id={uploadErrorId} className="text-sm text-destructive" role="alert">
                  {uploadError}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isBusy}
              className="min-h-11 w-full sm:w-auto"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-1" />
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={isBusy}
              className="min-h-11 w-full bg-primary hover:bg-primary/90 sm:w-auto"
            >
              {isBusy ? (
                <HugeiconsIcon icon={Loading03Icon} size={16} className="mr-1 animate-spin" />
              ) : (
                <HugeiconsIcon icon={Tick02Icon} size={16} className="mr-1" />
              )}
              {isEditing ? "Simpan Perubahan" : "Buat Layanan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl font-semibold">
              {editingCatId ? "Ubah Kategori" : "Tambah Kategori"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium">Nama Kategori *</label>
            <Input
              id="category-name"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Misal: Lulur Tradisional"
              autoFocus
              className="min-h-11"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setIsCatDialogOpen(false)} disabled={isCatBusy} className="min-h-11">
              Batal
            </Button>
            <Button onClick={handleSaveCategory} disabled={isCatBusy || !catName.trim()} className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90">
              {isCatBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

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
} from "@hugeicons/core-free-icons";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/constants";
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

type ServiceCategory = "MASSAGE" | "FACIAL" | "BODY_TREATMENT" | "PACKAGE";

interface ServiceFormData {
  name: string;
  description: string;
  duration: number;
  price: number;
  category: ServiceCategory;
  image_url: string;
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
  image_url: "",
};

interface ServicesClientProps {
  initialServices: Service[];
}

export function ServicesClient({ initialServices }: ServicesClientProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>(initialServices);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "ALL">("ALL");

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

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
      image_url: service.image_url || "",
    });
    setIsEditing(true);
    setEditingId(service.id);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      showToast("Please fill in required fields", "error");
      return;
    }

    setIsSaving(true);

    if (isEditing && editingId) {
      const previous = services;
      const optimisticUpdated = services.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: formData.name,
              description: formData.description || null,
              duration: formData.duration,
              price: formData.price,
              category: formData.category,
              image_url: formData.image_url || null,
              updated_at: new Date().toISOString(),
            }
          : s
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
          image_url: formData.image_url || null,
        } as ServiceUpdate);

        if (updated) {
          setServices((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
          showToast("Service updated successfully", "success");
          setIsDialogOpen(false);
        } else {
          throw new Error("Failed to update");
        }
      } catch {
        setServices(previous);
        showToast("Failed to save service", "error");
      } finally {
        setOptimistic(editingId, false);
        setIsSaving(false);
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
      image_url: formData.image_url || null,
      is_active: true,
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
        image_url: formData.image_url || null,
      } as ServiceInsert);

      if (created) {
        setServices((prev) => prev.map((s) => (s.id === tempId ? created : s)));
        showToast("Service created successfully", "success");
        setIsDialogOpen(false);
      } else {
        throw new Error("Failed to create");
      }
    } catch {
      setServices(previous);
      showToast("Failed to save service", "error");
    } finally {
      setOptimistic(tempId, false);
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    setOptimistic(id, true);
    const previous = services;

    setServices((prev) => prev.filter((s) => s.id !== id));

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

  return (
    <>
      <DashboardHeader title="Service Management" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        {/* Action Bar */}
        <div className={cn(
          "flex items-center justify-between mb-6",
          isMounted ? "animate-fade-slide-down" : "opacity-0"
        )}>
          <p className="text-muted-foreground text-sm">
            Manage spa services, pricing, and availability
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="btn-hover-lift">
            <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
            Add Service
          </Button>
        </div>
        {/* Filters */}
        <div className={cn(
          "bg-card rounded-2xl shadow-spa border border-border p-4 mb-6",
          isMounted ? "animate-fade-slide-up" : "opacity-0"
        )} style={{ animationDelay: "100ms" }}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as ServiceCategory | "ALL")}
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

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-spa border border-border p-12 text-center">
            <HugeiconsIcon icon={Tag01Icon} size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No services found
            </h3>
            <p className="text-muted-foreground mb-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service, index) => {
              const isOptimistic = optimisticIds.has(service.id);
              return (
                <div
                  key={service.id}
                  className={cn(
                    "bg-card rounded-2xl shadow-spa border border-border overflow-hidden transition-all hover:shadow-spa-lg card-hover-lift",
                    !service.is_active && "opacity-60",
                    isOptimistic && "opacity-70 saturate-50",
                    isMounted ? "animate-fade-slide-up" : "opacity-0"
                  )}
                  style={{ animationDelay: `${200 + index * 75}ms` }}
                >
                  <div className="relative h-40">
                    <Image
                      src={
                        service.image_url ||
                        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80"
                      }
                      alt={service.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      {isOptimistic && (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                          <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                          Syncing
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          service.is_active
                            ? "bg-primary text-primary-foreground"
                            : "bg-destructive text-destructive-foreground"
                        }`}
                      >
                        {service.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-card/90 backdrop-blur text-muted-foreground">
                        {CATEGORY_LABELS[service.category]}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-sans font-semibold text-xl text-foreground mb-1">
                      {service.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[40px]">
                      {service.description || "No description"}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} size={16} />
                        <span className="text-sm">{service.duration} mins</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(service.price)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border">
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
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-sans font-semibold text-xl">
              {isEditing ? "Edit Service" : "Create New Service"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Service Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g., Balinese Massage"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Describe the service..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Duration (mins) *
                </label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      duration: parseInt(e.target.value) || 60,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Price (IDR) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={50000}
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      price: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Category *
              </label>
              <Select
                value={formData.category}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, category: v as ServiceCategory }))
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

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Image URL
              </label>
              <Input
                value={formData.image_url}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, image_url: e.target.value }))
                }
                placeholder="https://..."
              />
              {formData.image_url && (
                <div className="mt-2 relative h-32 rounded-lg overflow-hidden">
                  <Image
                    src={formData.image_url}
                    alt="Preview"
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
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

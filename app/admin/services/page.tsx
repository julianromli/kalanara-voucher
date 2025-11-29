"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Clock,
  X,
  Check,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
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
import {
  getServices,
  getAllServices,
  createService,
  updateService,
  deleteService,
} from "@/lib/actions/services";
import type { Service, ServiceInsert, ServiceUpdate } from "@/lib/database.types";

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

export default function AdminServicesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "ALL">("ALL");

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    async function fetchServices() {
      const data = await getAllServices();
      setServices(data);
      setLoading(false);
    }
    if (isAuthenticated) {
      fetchServices();
    }
  }, [isAuthenticated]);

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

    try {
      if (isEditing && editingId) {
        const updated = await updateService(editingId, {
          name: formData.name,
          description: formData.description || null,
          duration: formData.duration,
          price: formData.price,
          category: formData.category,
          image_url: formData.image_url || null,
        } as ServiceUpdate);

        if (updated) {
          setServices((prev) =>
            prev.map((s) => (s.id === editingId ? updated : s))
          );
          showToast("Service updated successfully", "success");
        } else {
          throw new Error("Failed to update");
        }
      } else {
        const created = await createService({
          name: formData.name,
          description: formData.description || null,
          duration: formData.duration,
          price: formData.price,
          category: formData.category,
          image_url: formData.image_url || null,
        } as ServiceInsert);

        if (created) {
          setServices((prev) => [...prev, created]);
          showToast("Service created successfully", "success");
        } else {
          throw new Error("Failed to create");
        }
      }

      setIsDialogOpen(false);
    } catch {
      showToast("Failed to save service", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const success = await deleteService(id);
      if (success) {
        setServices((prev) => prev.filter((s) => s.id !== id));
        showToast("Service deactivated", "success");
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      showToast("Failed to delete service", "error");
    } finally {
      setIsDeleting(null);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-sage-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-sand-300" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-sage-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag size={24} className="text-sand-400" />
              <h1 className="font-sans font-semibold text-2xl text-sand-100">
                Service Management
              </h1>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-sand-500 hover:bg-sand-400 text-sage-900"
            >
              <Plus size={18} className="mr-2" />
              Add Service
            </Button>
          </div>
          <p className="text-sage-400 mt-2">
            Manage spa services, pricing, and availability
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
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
                <Filter size={16} className="mr-2" />
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-sage-500" size={32} />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-spa border border-sage-100 p-12 text-center">
            <Tag size={48} className="text-sage-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-sage-700 mb-2">
              No services found
            </h3>
            <p className="text-sage-500 mb-6">
              {searchQuery || categoryFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Create your first service to get started"}
            </p>
            {!searchQuery && categoryFilter === "ALL" && (
              <Button onClick={handleOpenCreate} className="bg-sage-700 hover:bg-sage-600">
                <Plus size={18} className="mr-2" />
                Create Service
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className={`bg-white rounded-2xl shadow-spa border border-sage-100 overflow-hidden transition-all hover:shadow-spa-lg ${
                  !service.is_active ? "opacity-60" : ""
                }`}
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
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        service.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {service.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/90 backdrop-blur text-sage-700">
                      {CATEGORY_LABELS[service.category]}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-sans font-semibold text-xl text-sage-900 mb-1">
                    {service.name}
                  </h3>
                  <p className="text-sm text-sage-500 line-clamp-2 mb-4 min-h-[40px]">
                    {service.description || "No description"}
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 text-sage-600">
                      <Clock size={16} />
                      <span className="text-sm">{service.duration} mins</span>
                    </div>
                    <span className="font-semibold text-sage-800">
                      {formatCurrency(service.price)}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-sage-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(service)}
                      className="flex-1"
                    >
                      <Pencil size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(service.id)}
                      disabled={isDeleting === service.id}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                    >
                      {isDeleting === service.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
              <label className="block text-sm text-sage-700 mb-1.5">
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
              <label className="block text-sm text-sage-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Describe the service..."
                rows={3}
                className="w-full px-3 py-2 border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-sage-700 mb-1.5">
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
                <label className="block text-sm text-sage-700 mb-1.5">
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
              <label className="block text-sm text-sage-700 mb-1.5">
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
              <label className="block text-sm text-sage-700 mb-1.5">
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

          <div className="flex gap-3 justify-end pt-4 border-t border-sage-100">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              <X size={16} className="mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-sage-700 hover:bg-sage-600"
            >
              {isSaving ? (
                <Loader2 size={16} className="mr-1 animate-spin" />
              ) : (
                <Check size={16} className="mr-1" />
              )}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

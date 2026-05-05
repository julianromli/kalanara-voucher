"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientUploadedFileData } from "uploadthing/types";
import {
  createTestimonial,
  deleteTestimonial,
  updateSiteSetting,
  updateTestimonial,
} from "@/lib/actions/crm";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/context/ToastContext";
import { UploadDropzone } from "@/lib/uploadthing-client";
import { type Testimonial, type TestimonialInsert } from "@/lib/database.types";
import { Edit2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CRMClientProps {
  initialAnnouncement: string;
  initialHeroImage: string;
  testimonials: Testimonial[];
}

type HeroImageUploadData = {
  uploadedBy: string;
  imageUrl: string;
  fileKey: string;
};

function sortTestimonials(items: Testimonial[]) {
  return [...items].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return right.created_at.localeCompare(left.created_at);
  });
}

function buildTestimonialPayload(
  form: Partial<TestimonialInsert>
): TestimonialInsert {
  const forText = form.for_text?.trim() ?? "";
  const quote = form.quote?.trim() ?? "";
  const initials = (form.initials?.trim().toUpperCase() ?? "").slice(0, 2);
  const name = form.name?.trim() ?? "";
  const location = form.location?.trim() ?? "";

  if (!forText || !quote || !initials || !name || !location) {
    throw new Error("Please complete all testimonial fields.");
  }

  return {
    for_text: forText,
    quote,
    initials,
    name,
    location,
    sort_order: Number.isFinite(Number(form.sort_order))
      ? Number(form.sort_order)
      : 0,
    is_active: form.is_active ?? true,
  };
}

export function CRMClient({
  initialAnnouncement,
  initialHeroImage,
  testimonials,
}: CRMClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [heroImage, setHeroImage] = useState(initialHeroImage);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [testimonialItems, setTestimonialItems] = useState<Testimonial[]>(() =>
    sortTestimonials(testimonials)
  );
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<Partial<TestimonialInsert>>({
    for_text: "",
    quote: "",
    initials: "",
    name: "",
    location: "",
    sort_order: 0,
    is_active: true,
  });
  const [isSavingTestimonial, setIsSavingTestimonial] = useState(false);

  useEffect(() => {
    setAnnouncement(initialAnnouncement);
  }, [initialAnnouncement]);

  useEffect(() => {
    setHeroImage(initialHeroImage);
  }, [initialHeroImage]);

  useEffect(() => {
    setTestimonialItems(sortTestimonials(testimonials));
  }, [testimonials]);

  const handleSaveAnnouncement = async () => {
    try {
      setIsSavingAnnouncement(true);
      const trimmedAnnouncement = announcement.trim();
      await updateSiteSetting("announcement_text", trimmedAnnouncement);
      setAnnouncement(trimmedAnnouncement);
      router.refresh();
      showToast("Announcement saved successfully.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to save announcement.", "error");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const handleSaveHeroImage = async (url: string) => {
    try {
      await updateSiteSetting("hero_image_url", url);
      setHeroImage(url);
      router.refresh();
      showToast("Hero image updated successfully.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update hero image.", "error");
    }
  };

  const handleOpenTestimonialModal = (testimonial?: Testimonial) => {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setTestimonialForm({
        for_text: testimonial.for_text,
        quote: testimonial.quote,
        initials: testimonial.initials,
        name: testimonial.name,
        location: testimonial.location,
        sort_order: testimonial.sort_order,
        is_active: testimonial.is_active,
      });
    } else {
      setEditingTestimonial(null);
      setTestimonialForm({
        for_text: "",
        quote: "",
        initials: "",
        name: "",
        location: "",
        sort_order: (testimonialItems[testimonialItems.length - 1]?.sort_order || 0) + 10,
        is_active: true,
      });
    }

    setIsTestimonialModalOpen(true);
  };

  const handleSaveTestimonial = async () => {
    try {
      setIsSavingTestimonial(true);
      const payload = buildTestimonialPayload(testimonialForm);

      if (editingTestimonial) {
        const updated = await updateTestimonial(editingTestimonial.id, payload);
        setTestimonialItems((current) =>
          sortTestimonials(
            current.map((item) => (item.id === updated.id ? updated : item))
          )
        );
        showToast("Testimonial updated successfully.", "success");
      } else {
        const created = await createTestimonial(payload);
        setTestimonialItems((current) => sortTestimonials([...current, created]));
        showToast("Testimonial created successfully.", "success");
      }

      setIsTestimonialModalOpen(false);
      setEditingTestimonial(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Failed to save testimonial.",
        "error"
      );
    } finally {
      setIsSavingTestimonial(false);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) {
      return;
    }

    try {
      await deleteTestimonial(id);
      setTestimonialItems((current) => current.filter((item) => item.id !== id));
      router.refresh();
      showToast("Testimonial deleted successfully.", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete testimonial.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-4">
        <DashboardHeader title="CRM" />
        <p className="text-muted-foreground px-3 sm:px-4 md:px-6">
          Manage website content and settings
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Announcement Bar</CardTitle>
            <CardDescription>
              Update the text shown at the very top of the website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                placeholder="E.g. FLASH SALE 5.5 ...... BERAKHIR DALAM"
              />
              <Button onClick={handleSaveAnnouncement} disabled={isSavingAnnouncement}>
                {isSavingAnnouncement ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hero Section Image</CardTitle>
            <CardDescription>
              Update the background image for the main landing area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {heroImage ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage}
                    alt="Hero Preview"
                    className="object-cover w-full h-full opacity-50"
                  />
                </div>
              ) : null}

              <UploadDropzone
                endpoint="heroImageUploader"
                onUploadBegin={() => setIsUploadingHero(true)}
                onClientUploadComplete={(
                  uploads: ClientUploadedFileData<HeroImageUploadData>[]
                ) => {
                  setIsUploadingHero(false);
                  const uploadedUrl =
                    uploads[0]?.serverData?.imageUrl ?? uploads[0]?.url;

                  if (uploadedUrl) {
                    void handleSaveHeroImage(uploadedUrl);
                  }
                }}
                onUploadError={(error: Error) => {
                  setIsUploadingHero(false);
                  showToast(`Upload failed: ${error.message}`, "error");
                }}
              />
              {isUploadingHero ? (
                <p className="text-sm text-muted-foreground">
                  Uploading hero image...
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Testimonials</CardTitle>
            <CardDescription>
              Manage the customer reviews shown on the landing page.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenTestimonialModal()} size="sm">
            <Plus className="size-4 mr-2" /> Add Testimonial
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testimonialItems.map((testimonial) => (
              <div
                key={testimonial.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{testimonial.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({testimonial.location})
                    </span>
                    {!testimonial.is_active ? (
                      <span className="text-xs bg-muted px-2 py-1 rounded-md">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm italic">&quot;{testimonial.quote}&quot;</p>
                  <p className="text-xs text-primary font-medium uppercase tracking-wider">
                    {testimonial.for_text}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenTestimonialModal(testimonial)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteTestimonial(testimonial.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {testimonialItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No testimonials found.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isTestimonialModalOpen} onOpenChange={setIsTestimonialModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tag / For Text</label>
              <Input
                value={testimonialForm.for_text}
                onChange={(event) =>
                  setTestimonialForm((current) => ({
                    ...current,
                    for_text: event.target.value,
                  }))
                }
                placeholder="e.g. untuk mama"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Quote</label>
              <Input
                value={testimonialForm.quote}
                onChange={(event) =>
                  setTestimonialForm((current) => ({
                    ...current,
                    quote: event.target.value,
                  }))
                }
                placeholder="The actual testimonial text"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Initials</label>
                <Input
                  value={testimonialForm.initials}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      initials: event.target.value,
                    }))
                  }
                  placeholder="e.g. AR"
                  maxLength={2}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={testimonialForm.name}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Arika R."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={testimonialForm.location}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="e.g. Jakarta Selatan"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input
                  type="number"
                  value={testimonialForm.sort_order ?? 0}
                  onChange={(event) =>
                    setTestimonialForm((current) => ({
                      ...current,
                      sort_order: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="testimonial-active"
                checked={testimonialForm.is_active ?? true}
                onCheckedChange={(checked) =>
                  setTestimonialForm((current) => ({
                    ...current,
                    is_active: checked === true,
                  }))
                }
              />
              <label
                htmlFor="testimonial-active"
                className="text-sm font-medium cursor-pointer"
              >
                Show this testimonial on the landing page
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTestimonialModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTestimonial} disabled={isSavingTestimonial}>
              {isSavingTestimonial ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

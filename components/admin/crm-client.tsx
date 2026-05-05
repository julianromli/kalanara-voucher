"use client";

import { useState } from "react";
import { updateSiteSetting, createTestimonial, updateTestimonial, deleteTestimonial } from "@/lib/actions/crm";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { UploadDropzone } from "@/lib/uploadthing-client";
import { Testimonial, TestimonialInsert } from "@/lib/database.types";
import { Trash2, Edit2, Plus, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CRMClientProps {
  initialAnnouncement: string;
  initialHeroImage: string;
  testimonials: Testimonial[];
}

export function CRMClient({ initialAnnouncement, initialHeroImage, testimonials }: CRMClientProps) {
  const { showToast } = useToast();
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  
  const [heroImage, setHeroImage] = useState(initialHeroImage);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

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

  const handleSaveAnnouncement = async () => {
    try {
      setIsSavingAnnouncement(true);
      await updateSiteSetting("announcement_text", announcement);
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
      setHeroImage(url);
      await updateSiteSetting("hero_image_url", url);
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
        sort_order: (testimonials[testimonials.length - 1]?.sort_order || 0) + 10,
        is_active: true,
      });
    }
    setIsTestimonialModalOpen(true);
  };

  const handleSaveTestimonial = async () => {
    try {
      setIsSavingTestimonial(true);
      if (editingTestimonial) {
        await updateTestimonial(editingTestimonial.id, testimonialForm);
        showToast("Testimonial updated successfully.", "success");
      } else {
        await createTestimonial(testimonialForm as TestimonialInsert);
        showToast("Testimonial created successfully.", "success");
      }
      setIsTestimonialModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast("Failed to save testimonial.", "error");
    } finally {
      setIsSavingTestimonial(false);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await deleteTestimonial(id);
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
        <p className="text-muted-foreground px-3 sm:px-4 md:px-6">Manage website content and settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Announcement Bar</CardTitle>
            <CardDescription>Update the text shown at the very top of the website.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input 
                value={announcement} 
                onChange={(e) => setAnnouncement(e.target.value)} 
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
            <CardDescription>Update the background image for the main landing area.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {heroImage && (
                <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImage} alt="Hero Preview" className="object-cover w-full h-full opacity-50" />
                </div>
              )}
              
              <UploadDropzone
                endpoint="heroImageUploader"
                onUploadBegin={() => setIsUploadingHero(true)}
                onClientUploadComplete={(res: any) => {
                  setIsUploadingHero(false);
                  if (res?.[0]) {
                    handleSaveHeroImage(res[0].url);
                  }
                }}
                onUploadError={(error: Error) => {
                  setIsUploadingHero(false);
                  showToast(`Upload failed: ${error.message}`, "error");
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Testimonials</CardTitle>
            <CardDescription>Manage the customer reviews shown on the landing page.</CardDescription>
          </div>
          <Button onClick={() => handleOpenTestimonialModal()} size="sm">
            <Plus className="size-4 mr-2" /> Add Testimonial
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testimonials.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{t.name}</span>
                    <span className="text-sm text-muted-foreground">({t.location})</span>
                    {!t.is_active && <span className="text-xs bg-muted px-2 py-1 rounded-md">Inactive</span>}
                  </div>
                  <p className="text-sm italic">&quot;{t.quote}&quot;</p>
                  <p className="text-xs text-primary font-medium uppercase tracking-wider">{t.for_text}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleOpenTestimonialModal(t)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteTestimonial(t.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {testimonials.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No testimonials found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isTestimonialModalOpen} onOpenChange={setIsTestimonialModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingTestimonial ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tag / For Text</label>
              <Input 
                value={testimonialForm.for_text} 
                onChange={(e) => setTestimonialForm({ ...testimonialForm, for_text: e.target.value })} 
                placeholder="e.g. untuk mama"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Quote</label>
              <Input 
                value={testimonialForm.quote} 
                onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })} 
                placeholder="The actual testimonial text"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Initials</label>
                <Input 
                  value={testimonialForm.initials} 
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, initials: e.target.value })} 
                  placeholder="e.g. AR"
                  maxLength={2}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Name</label>
                <Input 
                  value={testimonialForm.name} 
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })} 
                  placeholder="e.g. Arika R."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Location</label>
                <Input 
                  value={testimonialForm.location} 
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, location: e.target.value })} 
                  placeholder="e.g. Jakarta Selatan"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input 
                  type="number"
                  value={testimonialForm.sort_order} 
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, sort_order: parseInt(e.target.value) || 0 })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestimonialModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTestimonial} disabled={isSavingTestimonial}>
              {isSavingTestimonial ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

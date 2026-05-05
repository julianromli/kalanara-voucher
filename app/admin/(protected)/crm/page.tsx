import { Metadata } from "next";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import { getSiteSetting, getAllTestimonials } from "@/lib/actions/crm";
import { CRMClient } from "@/components/admin/crm-client";

export const metadata: Metadata = {
  title: "CRM | Kalanara Admin",
  description: "Manage content such as announcements, hero image, and testimonials",
};

export default async function CRMPage() {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);

  const announcementSetting = await getSiteSetting("announcement_text");
  const heroImageSetting = await getSiteSetting("hero_image_url");
  const testimonials = await getAllTestimonials();

  const announcementText = announcementSetting?.value || "";
  const heroImageUrl = heroImageSetting?.value || "";

  return (
    <CRMClient 
      initialAnnouncement={announcementText} 
      initialHeroImage={heroImageUrl} 
      testimonials={testimonials} 
    />
  );
}

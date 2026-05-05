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

  const [
    announcementSetting,
    countdownEndAtSetting,
    heroImageSetting,
    testimonials,
  ] = await Promise.all([
    getSiteSetting("announcement_text"),
    getSiteSetting("announcement_countdown_end_at"),
    getSiteSetting("hero_image_url"),
    getAllTestimonials(),
  ]);

  const announcementText = announcementSetting?.value || "";
  const countdownEndAt = countdownEndAtSetting?.value || "";
  const heroImageUrl = heroImageSetting?.value || "";

  return (
    <CRMClient 
      initialAnnouncement={announcementText}
      initialCountdownEndAt={countdownEndAt}
      initialHeroImage={heroImageUrl}
      testimonials={testimonials} 
    />
  );
}

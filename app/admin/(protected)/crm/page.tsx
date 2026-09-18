import { Metadata } from "next";
import { AdminPermission } from "@/lib/auth/admin-rbac";
import { requireAdminPermission } from "@/lib/auth/admin-rbac-server";
import {
  getAllTestimonials,
  getLandingCopy,
  getSiteSetting,
} from "@/lib/actions/crm";
import { isAnnouncementCountdownEnabled } from "@/lib/site-settings";
import { CRMClient } from "@/components/admin/crm-client";

export const metadata: Metadata = {
  title: "CRM | Kalanara Admin",
  description: "Kelola teks, gambar, dan testimoni halaman utama",
};

export default async function CRMPage() {
  await requireAdminPermission(AdminPermission.CRM_MANAGE);

  const [
    announcementSetting,
    countdownEndAtSetting,
    countdownEnabledSetting,
    heroImageSetting,
    landingCopy,
    testimonials,
  ] = await Promise.all([
    getSiteSetting("announcement_text"),
    getSiteSetting("announcement_countdown_end_at"),
    getSiteSetting("announcement_countdown_enabled"),
    getSiteSetting("hero_image_url"),
    getLandingCopy(),
    getAllTestimonials(),
  ]);

  const announcementText = announcementSetting?.value || "";
  const countdownEndAt = countdownEndAtSetting?.value || "";
  const countdownEnabled = isAnnouncementCountdownEnabled(
    countdownEnabledSetting?.value
  );
  const heroImageUrl = heroImageSetting?.value || "";

  return (
    <CRMClient
      initialAnnouncement={announcementText}
      initialCountdownEndAt={countdownEndAt}
      initialCountdownEnabled={countdownEnabled}
      initialHeroImage={heroImageUrl}
      initialLandingCopy={landingCopy}
      testimonials={testimonials}
    />
  );
}

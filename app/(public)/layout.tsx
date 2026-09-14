import { Suspense } from "react";
import Navbar from "@/components/navbar";
import {
  getAnnouncementSettings,
  type AnnouncementSettings,
} from "@/lib/actions/crm";
import { isAnnouncementCountdownEnabled } from "@/lib/site-settings";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export async function PublicNavbar() {
  const settings = await getAnnouncementSettings().catch(
    (error): AnnouncementSettings => {
      console.error("Error loading announcement settings:", error);
      return {};
    }
  );

  return (
    <Navbar
      announcementText={
        settings.announcementText || "FLASH SALE 5.5 ...... BERAKHIR DALAM "
      }
      announcementCountdownEndAt={settings.countdownEndAt || undefined}
      announcementCountdownEnabled={isAnnouncementCountdownEnabled(
        settings.countdownEnabled
      )}
    />
  );
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <>
      <Suspense fallback={null}>
        <PublicNavbar />
      </Suspense>
      {children}
    </>
  );
}

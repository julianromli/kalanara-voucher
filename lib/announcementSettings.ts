import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { ANNOUNCEMENT_SETTINGS_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminClient } from "@/lib/supabase/admin";

const ANNOUNCEMENT_SETTING_KEYS = [
  "announcement_text",
  "announcement_countdown_end_at",
  "announcement_countdown_enabled",
] as const;

export interface AnnouncementSettings {
  announcementText?: string;
  countdownEndAt?: string;
  countdownEnabled?: string;
}

export async function getAnnouncementSettings(): Promise<AnnouncementSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(ANNOUNCEMENT_SETTINGS_CACHE_TAG);

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [...ANNOUNCEMENT_SETTING_KEYS]);

  if (error) {
    console.error("Error fetching announcement settings:", error);
    throw error;
  }

  const values = new Map(
    (data || []).map(({ key, value }) => [key, value])
  );

  return {
    announcementText: values.get("announcement_text"),
    countdownEndAt: values.get("announcement_countdown_end_at"),
    countdownEnabled: values.get("announcement_countdown_enabled"),
  };
}

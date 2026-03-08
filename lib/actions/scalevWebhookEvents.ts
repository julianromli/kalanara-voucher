"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import type {
  ScalevWebhookEvent,
  ScalevWebhookEventInsert,
  ScalevWebhookEventUpdate,
} from "@/lib/database.types";

export async function createScalevWebhookEvent(
  event: ScalevWebhookEventInsert
): Promise<ScalevWebhookEvent | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("scalev_webhook_events")
    .upsert(event, {
      onConflict: "external_event_hash",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating scalev webhook event:", error);
    return null;
  }

  return data;
}

export async function updateScalevWebhookEvent(
  id: string,
  updates: ScalevWebhookEventUpdate
): Promise<boolean> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("scalev_webhook_events")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating scalev webhook event:", error);
    return false;
  }

  return true;
}

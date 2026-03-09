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
    .insert(event)
    .select()
    .single();

  if (error) {
    if ("code" in error && error.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("scalev_webhook_events")
        .select("*")
        .eq("external_event_hash", event.external_event_hash)
        .single();

      if (existingError) {
        console.error(
          "Error fetching duplicate scalev webhook event:",
          existingError
        );
        return null;
      }

      return existing;
    }

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

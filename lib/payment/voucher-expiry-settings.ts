import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_VOUCHER_EXPIRATION_DAYS,
  VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY,
  parseVoucherExpirationDays,
} from "@/lib/payment/voucher-expiry";

export async function getVoucherDefaultExpirationDays(): Promise<number> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", VOUCHER_DEFAULT_EXPIRATION_DAYS_KEY)
    .maybeSingle();

  if (error) {
    console.error("Error fetching voucher default expiration days:", error);
    return DEFAULT_VOUCHER_EXPIRATION_DAYS;
  }

  return parseVoucherExpirationDays(data?.value);
}

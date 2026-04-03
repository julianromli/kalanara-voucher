import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { safeStorage } from "@/lib/utils/safe-storage";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use safe storage adapter to prevent SecurityError in restricted environments
        storage: {
          getItem: (key: string) => safeStorage.getItem(key),
          setItem: (key: string, value: string) => safeStorage.setItem(key, value),
          removeItem: (key: string) => safeStorage.removeItem(key),
        },
      },
    }
  );

  return browserClient;
}

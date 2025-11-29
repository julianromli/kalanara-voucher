/**
 * Supabase Admin Client - Service Role Access
 *
 * ⚠️  SECURITY WARNING ⚠️
 * This client uses the service_role key which BYPASSES Row Level Security (RLS).
 * - ONLY use in server-side code (Server Actions, Route Handlers, API Routes)
 * - NEVER expose to the client or import in client components
 * - NEVER log or expose the service role key
 * - All operations with this client are trusted and unrestricted
 *
 * Use cases:
 * - Server actions that need to write data regardless of RLS policies
 * - Admin operations that require elevated privileges
 * - Background jobs and cron tasks
 *
 * For user-authenticated operations, use the regular server client from ./server.ts
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase admin client with service role privileges.
 * This client bypasses RLS and should only be used for trusted server operations.
 *
 * @throws Error if required environment variables are not set
 * @returns Supabase client with admin privileges
 */
export function createAdminClient() {
  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Please add it to your .env.local file."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "Please add it to your .env.local file. " +
        "You can find this key in your Supabase dashboard under Settings > API."
    );
  }

  // Create client with service role key
  // No session persistence needed - this is stateless server-side access
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and session persistence
      // Service role doesn't use user sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Singleton instance for reuse across server operations.
 * Lazy-initialized to avoid errors during build if env vars aren't set.
 */
let adminClientInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Gets a singleton admin client instance.
 * Use this for most server operations to avoid creating new clients repeatedly.
 *
 * ⚠️ SECURITY: Only call from server-side code
 *
 * @returns Cached Supabase admin client
 */
export function getAdminClient() {
  if (!adminClientInstance) {
    adminClientInstance = createAdminClient();
  }
  return adminClientInstance;
}

// Type export for external use
export type AdminClient = ReturnType<typeof createAdminClient>;

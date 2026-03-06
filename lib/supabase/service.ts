import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service role key — no cookies needed.
 * Safe to use in background jobs (Inngest), cron, webhooks.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );
}

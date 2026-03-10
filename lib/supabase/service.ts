import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service role key — no cookies needed.
 * Safe to use in background jobs (Inngest), cron, webhooks.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[supabase/service] MISSING ENV:", { url: !!url, key: !!key });
  }
  return createClient(url as string, key as string);
}

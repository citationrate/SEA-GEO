import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service role key — no cookies needed.
 * Points to seageo1 (data project) for background jobs (Inngest), cron, webhooks.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_URL;
  const key = process.env.SEAGEO_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[supabase/service] MISSING ENV:", { url: !!url, key: !!key });
  }
  return createClient(url as string, key as string, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

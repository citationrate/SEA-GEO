import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the CitationRate Supabase project (auth + profiles).
 * Used to update profiles columns (paypal_subscription_id, subscription_status, plan, etc.)
 * that live on the CitationRate project, not seageo1.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL        — CitationRate project URL
 *   CITATIONRATE_SERVICE_ROLE_KEY   — CitationRate service role key
 */
export function createCitationRateServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[citationrate-service] MISSING ENV:", { url: !!url, key: !!key });
  }
  return createClient(url as string, key as string, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;

/** Browser auth client — CitationRate project (login/session) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" as const, secure: true } }
      : undefined
  );
}

/** Browser data client — seageo1 project (queries, results, etc.) */
export function createDataClient() {
  return _createClient<Database>(
    process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_ANON_KEY!
  );
}

import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient as _createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/* ─── Cookie domain for cross-subdomain auth ─── */
const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;

function cookieOptions(base?: Record<string, unknown>) {
  if (!COOKIE_DOMAIN) return base;
  return { ...base, domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" as const, secure: true };
}

/* ─── AUTH client — CitationRate project (login/session) ─── */

/** Server client with anon key + cookies — for auth in Server Components & pages */
export function createServerClient() {
  const cookieStore = cookies();
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, cookieOptions(options))); }
          catch { /* ignored in Server Components */ }
        },
      },
    }
  );
}

/** Server client with service role key + cookies — for auth.getUser() in API routes */
export function createAuthServiceClient() {
  const cookieStore = cookies();
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

/* ─── DATA client — seageo1 project (queries, results, sources, etc.) ─── */

/** Service-role client for seageo1 data — no cookies, bypasses RLS */
export function createDataClient() {
  return _createClient<Database>(
    process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_URL as string,
    process.env.SEAGEO_SERVICE_ROLE_KEY as string,
    {
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    }
  );
}

/* ─── Legacy alias — returns data client (seageo1) ─── */
/* Most existing code does: const supabase = createServiceClient(); supabase.from(...) */
/* After the split, .from() must go to seageo1, so this alias makes migration easier. */
/* For auth.getUser(), use createServerClient() or createAuthServiceClient() instead. */
export function createServiceClient() {
  return createDataClient();
}

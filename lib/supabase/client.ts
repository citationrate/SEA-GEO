import { createBrowserClient } from "@supabase/ssr";
import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;
const SUITE_LOGIN_URL = "https://suite.citationrate.com";

/** Singleton browser auth client — prevents multiple instances competing for token refresh locks */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _authClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser auth client — CitationRate project (login/session) */
export function createClient() {
  if (_authClient) return _authClient;

  _authClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(COOKIE_DOMAIN
        ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" as const, secure: true } }
        : undefined),
      auth: {
        storageKey: "auth",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  // Redirect to suite login on sign-out or missing session — prevents infinite refresh loops
  _authClient.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    if (event === "SIGNED_OUT" || (!session && event === "INITIAL_SESSION")) {
      window.location.href = SUITE_LOGIN_URL;
    }
  });

  return _authClient;
}

/** Browser data client — seageo1 project (queries, results, etc.) */
export function createDataClient() {
  return _createClient<Database>(
    process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SEAGEO_SUPABASE_ANON_KEY!
  );
}

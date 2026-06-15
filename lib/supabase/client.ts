import { createBrowserClient } from "@supabase/ssr";
import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Host-only auth cookies: scoped to avi.citationrate.com, never the apex .citationrate.com.
// (Previously ".citationrate.com" in prod — removed so auth cookies stop reaching the PHP
// apex and blowing past its header limit. SSO now runs via URL-hash token handoff, not cookies.)
const COOKIE_DOMAIN: string | undefined = undefined;
const SUITE_BASE = "https://suite.citationrate.com";
const SUITE_LOGIN_URL = SUITE_BASE;

// One-shot guard so a transparent re-handoff can't loop into the suite login.
const SSO_RETRY_KEY = "avi_sso_retry";

/**
 * AVI lost its session. Instead of dumping the user at the suite login, ask the
 * suite to re-establish it server-side: its auth cookie is almost always still
 * valid (e.g. the user just logged in and AVI lost the cross-tool refresh-token
 * rotation race, or the cookie wasn't readable yet right after the handoff).
 * /api/sso/launch reads the suite session server-side and hands fresh tokens to
 * AVI's establish, then bounces back to `next` — invisible to the user.
 *
 * Guarded by a one-shot sessionStorage flag: if we already retried once and
 * still have no session, the suite is genuinely signed out, so fall through to
 * the real login instead of bouncing forever.
 */
function bounceToSuite() {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  let alreadyRetried = false;
  try { alreadyRetried = sessionStorage.getItem(SSO_RETRY_KEY) === "1"; } catch { /* private mode */ }
  if (alreadyRetried) {
    try { sessionStorage.removeItem(SSO_RETRY_KEY); } catch { /* noop */ }
    window.location.href = SUITE_LOGIN_URL;
    return;
  }
  try { sessionStorage.setItem(SSO_RETRY_KEY, "1"); } catch { /* noop */ }
  window.location.href = `${SUITE_BASE}/api/sso/launch?next=${encodeURIComponent(next)}`;
}

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
        // The storageKey IS the literal cookie name in @supabase/ssr. It must be
        // "sb-auth-auth-token" (the name the middleware + handoff already read),
        // NOT "auth" — which silently produced a cookie named "auth" that nothing
        // else looked for, breaking auth on every navigation.
        storageKey: "sb-auth-auth-token",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  // On sign-out or missing session, transparently re-handoff via the suite
  // (see bounceToSuite) instead of forcing a re-login. Skip on /auth/ pages
  // (handoff in progress) and public pages. INITIAL_SESSION fires synchronously
  // during init, so guard against SSR where `window` is undefined.
  _authClient.auth.onAuthStateChange((event, session) => {
    if (typeof window === "undefined") return;
    // A real session is present (initial read, refresh, or sign-in): clear the
    // one-shot guard so a future loss can retry the transparent re-handoff.
    if (session) {
      try { sessionStorage.removeItem(SSO_RETRY_KEY); } catch { /* noop */ }
      return;
    }
    if (event === "TOKEN_REFRESHED") return;
    const path = window.location.pathname;
    if (path.startsWith("/auth/") || path.startsWith("/share/") || path === "/") return;
    if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      bounceToSuite();
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

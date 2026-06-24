import { NextResponse, type NextRequest } from "next/server";

// In production we (a) gate auth-route redirects to the suite and (b) re-issue the
// session cookie server-side for Safari/iOS ITP. The cookie is now HOST-ONLY
// (avi.citationrate.com) — we no longer set Domain=.citationrate.com, which used to
// leak auth cookies onto the PHP apex and overflow its request-header limit.
const IS_PROD = process.env.NODE_ENV === "production";
const SUITE_LOGIN_URL = "https://suite.citationrate.com";
// One-shot guard so the transparent re-handoff can't loop into the suite login.
const SSO_RETRY_COOKIE = "sso_retry";

/**
 * Decode a JWT payload without verification (we trust Supabase's cookie).
 * Returns null if decoding fails.
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract the Supabase session from cookies.
 * Handles both single cookie and chunked cookie formats.
 * NEVER modifies or deletes cookies — read-only.
 */
function getSessionFromCookies(request: NextRequest): { userId: string; expired: boolean } | null {
  const cookies = request.cookies.getAll();

  // Find sb-auth-auth-token (single or chunked)
  const single = cookies.find(c => c.name === "sb-auth-auth-token");
  const chunk0 = cookies.find(c => c.name === "sb-auth-auth-token.0");

  let raw: string | null = null;

  if (single) {
    raw = single.value;
  } else if (chunk0) {
    // Reassemble chunked cookies
    const chunks: string[] = [];
    for (let i = 0; ; i++) {
      const chunk = cookies.find(c => c.name === `sb-auth-auth-token.${i}`);
      if (!chunk) break;
      chunks.push(chunk.value);
    }
    raw = chunks.join("");
  }

  if (!raw) return null;

  // Strip "base64-" prefix if present (Supabase SSR 0.9+ format)
  let cookieValue = raw;
  if (cookieValue.startsWith("base64-")) {
    cookieValue = cookieValue.slice(7);
  }

  // Try all possible formats
  const attempts = [
    // 1. base64-encoded JSON with access_token
    () => {
      const decoded = Buffer.from(cookieValue, "base64").toString();
      return JSON.parse(decoded);
    },
    // 2. Raw JSON
    () => JSON.parse(cookieValue),
    // 3. URL-decoded then JSON
    () => JSON.parse(decodeURIComponent(cookieValue)),
  ];

  for (const attempt of attempts) {
    try {
      const session = attempt();
      if (session?.access_token) {
        const jwt = decodeJwtPayload(session.access_token);
        if (jwt?.sub) {
          const expired = jwt.exp ? jwt.exp * 1000 < Date.now() : false;
          return { userId: jwt.sub, expired };
        }
      }
    } catch { /* try next */ }
  }

  // Last resort: cookie value itself might be a JWT
  const jwt = decodeJwtPayload(cookieValue);
  if (jwt?.sub) {
    const expired = jwt.exp ? jwt.exp * 1000 < Date.now() : false;
    return { userId: jwt.sub, expired };
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip auth for API routes (+ CORS per la suite). La suite chiama questi
  // endpoint DAL BROWSER per il lancio in-suite di AVI/BP: stesso sito
  // *.citationrate.com → i cookie auth passano, serve solo abilitare il CORS
  // con credenziali per l'origine suite. Additivo: nessun effetto same-origin.
  if (path.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    const ALLOWED = new Set<string>([
      "https://suite.citationrate.com",
      "https://avi.citationrate.com",
    ]);
    if (!IS_PROD) { ALLOWED.add("http://localhost:3000"); ALLOWED.add("http://localhost:3001"); }
    const corsOk = ALLOWED.has(origin);
    if (request.method === "OPTIONS" && corsOk) {
      const pre = new NextResponse(null, { status: 204 });
      pre.headers.set("Access-Control-Allow-Origin", origin);
      pre.headers.set("Access-Control-Allow-Credentials", "true");
      pre.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      pre.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      pre.headers.set("Vary", "Origin");
      return pre;
    }
    const res = NextResponse.next();
    if (corsOk) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
    }
    return res;
  }

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password");
  const isPublic = path === "/" || path.startsWith("/share/") || path.startsWith("/auth/");

  // In production: auth routes redirect to suite
  if (IS_PROD && isAuthRoute) {
    return NextResponse.redirect(SUITE_LOGIN_URL);
  }

  // Public routes pass through
  if (isPublic) {
    return NextResponse.next();
  }

  // Auth routes in dev
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // --- Protected routes: check cookie directly (read-only, never deletes cookies) ---
  const session = getSessionFromCookies(request);

  if (session) {
    // Valid (or expiring — client will refresh) session: allow through.
    // CRITICAL: protected pages must NEVER be cached cross-user. Without
    // these headers, Chrome bfcache / Vercel CDN can serve a previous
    // user's HTML to a freshly-logged-in different user on the same browser.
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    // Safari/iOS (ITP) purges cookies written by client-side JS after ~7 days.
    // The session cookie on AVI was only ever written client-side (handoff /
    // autoRefresh), so it got purged and the user was logged out on iPhone when
    // switching from CS. Re-issue it server-side on each navigation so the
    // browser keeps it for its full lifetime. Re-issues the current value as-is
    // — never mints or refreshes tokens here.
    if (IS_PROD) {
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith("sb-auth-auth-token")) {
          res.cookies.set(c.name, c.value, {
            path: "/",
            sameSite: "lax",
            secure: true,
            maxAge: 60 * 60 * 24 * 365,
          });
        }
      }
    }
    // Session restored: clear any one-shot re-handoff guard.
    if (request.cookies.get(SSO_RETRY_COOKIE)) {
      res.cookies.set(SSO_RETRY_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return res;
  }

  // No session cookie. Before forcing a re-login, try a single transparent
  // re-handoff through the suite: its session cookie is usually still valid
  // (e.g. the user just logged in and AVI lost the cross-tool refresh-token
  // rotation race), so /api/sso/launch can re-establish AVI server-side and
  // bounce back here. A one-shot guard cookie prevents an infinite loop when
  // the suite is genuinely signed out.
  if (IS_PROD) {
    if (!request.cookies.get(SSO_RETRY_COOKIE)) {
      const target = new URL("https://suite.citationrate.com/api/sso/launch");
      target.searchParams.set("next", path + request.nextUrl.search);
      const res = NextResponse.redirect(target);
      res.cookies.set(SSO_RETRY_COOKIE, "1", { path: "/", maxAge: 30, sameSite: "lax", secure: true });
      return res;
    }
    const res = NextResponse.redirect(SUITE_LOGIN_URL);
    res.cookies.set(SSO_RETRY_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

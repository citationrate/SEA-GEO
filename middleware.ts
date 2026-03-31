import { NextResponse, type NextRequest } from "next/server";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;
const SUITE_LOGIN_URL = "https://suite.citationrate.com";

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

  // Skip auth for API routes
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password");
  const isPublic = path === "/" || path.startsWith("/share/") || path.startsWith("/auth/");

  // In production: auth routes redirect to suite
  if (COOKIE_DOMAIN && isAuthRoute) {
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

  if (session && !session.expired) {
    // Valid session — allow through
    return NextResponse.next();
  }

  // Even if token is expired, allow through if cookie exists
  // (client-side will refresh the token)
  if (session && session.expired) {
    return NextResponse.next();
  }

  // No session cookie at all — redirect to login
  if (COOKIE_DOMAIN) {
    return NextResponse.redirect(SUITE_LOGIN_URL);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

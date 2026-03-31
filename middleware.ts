import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;
const SUITE_LOGIN_URL = "https://suite.citationrate.com";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip auth entirely for API routes (Inngest callbacks, analysis, etc.)
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // --- Diagnostic logging ---
  const allCookies = request.cookies.getAll();
  const authCookies = allCookies.filter(c => c.name.startsWith("sb-"));
  console.log("[MW]", path, "| all cookies:", allCookies.map(c => `${c.name}(${c.value.length})`).join(", "));
  console.log("[MW]", path, "| sb cookies:", authCookies.map(c => `${c.name}(${c.value.length})`).join(", ") || "NONE");

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password");
  const isPublic = path === "/" || path.startsWith("/share/") || path.startsWith("/auth/");

  // In production: auth routes redirect to suite — no auth call needed
  if (COOKIE_DOMAIN && isAuthRoute) {
    return NextResponse.redirect(SUITE_LOGIN_URL);
  }

  // Public routes don't need auth verification — let the page handle it
  if (isPublic) {
    return NextResponse.next();
  }

  // Auth routes in dev: serve directly (no getUser call needed — page handles redirect)
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // --- Only protected routes below: call getUser() ---

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: object }[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => {
            const opts = COOKIE_DOMAIN
              ? { ...(options as Record<string, unknown>), domain: COOKIE_DOMAIN, path: "/", sameSite: "lax", secure: true }
              : options;
            response.cookies.set(name, value, opts as never);
          });
        },
      },
    }
  );

  // Use getSession() — reads JWT from cookie without API call (faster, no rate limits)
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  console.log("[MW]", path, "| session:", user ? `OK (${user.id})` : `FAILED (${authError?.message ?? "no session"})`);

  if (!user) {
    // Not authenticated → redirect to login
    if (COOKIE_DOMAIN) {
      return NextResponse.redirect(SUITE_LOGIN_URL);
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

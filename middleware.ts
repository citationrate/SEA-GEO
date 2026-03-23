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

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password");
  const isPublic = path === "/" || path.startsWith("/share/") || path.startsWith("/auth/");

  // In production: login/register pages redirect to suite (login lives there)
  if (COOKIE_DOMAIN && isAuthRoute) {
    return NextResponse.redirect(SUITE_LOGIN_URL);
  }

  if (!user && !isAuthRoute && !isPublic) {
    // Not authenticated → redirect to CitationRate login
    if (COOKIE_DOMAIN) {
      return NextResponse.redirect(SUITE_LOGIN_URL);
    }
    // Dev: use local login page
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

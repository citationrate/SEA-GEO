import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;
const LOGIN_URL = process.env.NODE_ENV === "production"
  ? "https://suite.citationrate.com"
  : "/login";

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
              ? { ...(options as Record<string, unknown>), domain: COOKIE_DOMAIN }
              : options;
            response.cookies.set(name, value, opts as never);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register");
  const isPublic = path === "/" || path.startsWith("/share/") || path.startsWith("/auth/");

  if (!user && !isAuthRoute && !isPublic) {
    // In production, redirect to CitationRate login (shared auth)
    // In dev, redirect to local /login page
    if (LOGIN_URL.startsWith("http")) {
      return NextResponse.redirect(LOGIN_URL);
    }
    return NextResponse.redirect(new URL(LOGIN_URL, request.url));
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

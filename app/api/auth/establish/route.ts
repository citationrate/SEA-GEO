import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side session establishment for the cross-tool SSO handoff.
 *
 * Reached as a top-level **form POST navigation** from /auth/handoff (tokens in
 * the request body, never in a URL → no leak into logs/Referer). We run
 * setSession on the server (clean clock, no ITP) and write the host-only auth
 * cookie via a **redirect response** (302 + Set-Cookie).
 *
 * Why a navigation redirect and not a fetch + client redirect: Safari Private /
 * iOS does NOT reliably apply `Set-Cookie` from a `fetch()` (XHR) response to
 * the subsequent navigation — the cookie was written but the next GET /dashboard
 * arrived without it, so AVI's middleware bounced the user to login. A Set-Cookie
 * carried on a navigation (redirect) response is committed by the browser before
 * it follows the Location, exactly like a classic server-rendered login. This is
 * immune to ITP and works identically across Safari/Chrome/incognito.
 */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const form = await request.formData().catch(() => null);
  const access_token = form ? String(form.get("access_token") ?? "") : "";
  const refresh_token = form ? String(form.get("refresh_token") ?? "") : "";

  const rawNext = form ? String(form.get("next") ?? "") : "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!access_token || !refresh_token) {
    return NextResponse.redirect(new URL("/login?sso=missing_tokens", origin), 303);
  }

  // Success response: the cookie adapter writes Set-Cookie straight onto this
  // 303 redirect, so the cookie is committed as part of the navigation.
  const res = NextResponse.redirect(new URL(next, origin), 303);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { storageKey: "sb-auth-auth-token" },
      cookieEncoding: "base64url",
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          toSet.forEach(({ name, value }) => {
            // Host-only on avi.citationrate.com (no Domain). Secure + long max-age
            // so Safari/iOS ITP keeps it; SameSite=Lax for the cross-subdomain nav.
            res.cookies.set(name, value, {
              path: "/",
              sameSite: "lax",
              secure: true,
              maxAge: 60 * 60 * 24 * 365,
            });
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error || !data?.session) {
    console.error("[establish] setSession failed", {
      msg: error?.message,
      status: (error as { status?: number } | null)?.status,
      name: error?.name,
    });
    return NextResponse.redirect(new URL("/login?sso=set_session_failed", origin), 303);
  }

  console.log("[establish] ok", {
    userId: data.session.user.id,
    next,
    setCookies: res.cookies.getAll().map((c) => c.name),
  });
  return res;
}

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

  // Success response: an HTML page that sets the cookie (Set-Cookie written by
  // the adapter below) and then does a *fresh JS navigation* to `next`.
  // We deliberately do NOT 303-redirect: the request chain reaching here
  // crosses a cross-site hop (suite → avi), and Chrome won't send a SameSite=Lax
  // cookie on a navigation whose redirect chain contains a cross-site member —
  // so the redirected GET /dashboard arrived without the cookie and bounced to
  // login (Safari is more lenient, which is why it worked there). A fresh
  // top-level navigation initiated from this avi page has a clean same-site
  // chain, so the just-set Lax cookie is sent. The cookie itself is first-party
  // (top-level origin is avi at this point), so it is stored in all browsers.
  const nextJson = JSON.stringify(next);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Accesso…</title>` +
    `<script>location.replace(${nextJson})</script>` +
    `<noscript><meta http-equiv="refresh" content="0;url=${next}"></noscript></head>` +
    `<body style="background:#0b0b0c"></body></html>`;
  const res = new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

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

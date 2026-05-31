import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side session establishment for the cross-tool SSO handoff.
 *
 * Why this exists: the client-side `supabase.auth.setSession()` in
 * /auth/handoff was unreliable on Safari Private / Chrome Incognito / iOS — its
 * internal getUser() network call and the JS-written (document.cookie) auth
 * cookie didn't survive to the next navigation, so AVI's middleware/layout
 * bounced the user back to suite.citationrate.com (login). It only looked fine
 * in normal browsers because a pre-existing same-user session masked it.
 *
 * The handoff page reads the tokens from the URL hash (never sent to the
 * server, no leak into logs/Referer) and POSTs them here. We run setSession on
 * the server (clean clock, no ITP) and write the host-only auth cookie as a
 * real HTTP `Set-Cookie` *directly on the response we return* — NOT via
 * next/headers cookies(), whose merge into a JSON fetch response is unreliable
 * in Next 14. The browser commits the cookie before the subsequent navigation.
 */
export async function POST(request: NextRequest) {
  let body: { access_token?: unknown; refresh_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const access_token = typeof body.access_token === "string" ? body.access_token : null;
  const refresh_token = typeof body.refresh_token === "string" ? body.refresh_token : null;

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
  }

  // The response we'll return on success — the cookie adapter writes Set-Cookie
  // headers straight onto it, guaranteeing they reach the browser.
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { storageKey: "sb-auth-auth-token" },
      cookieEncoding: "base64url",
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          toSet.forEach(({ name, value, options }) => {
            // Host-only on avi.citationrate.com (no Domain). Long max-age + Secure
            // so Safari/iOS ITP keeps it; SameSite=Lax for the cross-subdomain nav.
            res.cookies.set(name, value, {
              ...options,
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
    return NextResponse.json(
      { ok: false, error: error?.message ?? "set_session_failed", name: error?.name ?? null },
      { status: 401 },
    );
  }

  const setCookieNames = res.cookies.getAll().map((c) => c.name);
  console.log("[establish] ok", { userId: data.session.user.id, setCookies: setCookieNames });
  return res;
}

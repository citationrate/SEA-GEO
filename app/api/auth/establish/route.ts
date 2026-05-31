import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Server-side session establishment for the cross-tool SSO handoff.
 *
 * Why this exists: the client-side `supabase.auth.setSession()` in
 * /auth/handoff was unreliable on Safari Private / Chrome Incognito (and iOS).
 * In those contexts setSession()'s internal `getUser()` network call + the
 * client-written (document.cookie) auth cookie don't survive to the next
 * navigation, so AVI's middleware/layout see "no session" and bounce the user
 * back to suite.citationrate.com (= login). It only *looked* fine in normal
 * browsers because a pre-existing same-user session masked the failure.
 *
 * The fix: the handoff page reads the tokens from the URL hash (never sent to
 * the server, so no leak into logs/Referer) and POSTs them here. This route
 * runs on Vercel — clean clock, no ITP, no private-mode quirks — calls
 * setSession server-side, and writes the host-only auth cookie as a real HTTP
 * `Set-Cookie` on the response. The browser commits it before the subsequent
 * navigation, so the session is reliably visible to the middleware + layouts.
 *
 * Cookies are written by the @supabase/ssr server client's cookie adapter
 * (see lib/supabase/server.ts → cookieOptions): host-only on avi.citationrate.com.
 */
export async function POST(request: Request) {
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

  const supabase = createServerClient();

  // setSession validates the access token (getUser) and, on success, the SSR
  // cookie adapter writes the chunked host-only auth cookie onto this response.
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error || !data?.session) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "set_session_failed" },
      { status: 401 },
    );
  }

  // The Set-Cookie headers were attached by the cookie adapter during
  // setSession. Returning a normal JSON response carries them to the browser.
  return NextResponse.json({ ok: true, userId: data.session.user.id });
}

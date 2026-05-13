import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".citationrate.com" : undefined;

/**
 * Force-delete every Supabase auth cookie left over from previous sessions.
 *
 * Why this is needed: supabase-js' signOut() emits Set-Cookie deletes for the
 * cookies it currently knows about. If a previous chunked session left orphan
 * chunks (e.g. `sb-auth-auth-token.2` that the new shorter session never
 * overwrote), signOut() may not touch them and they survive logout. On the
 * next login the middleware can reassemble a Frankenstein cookie that
 * decodes to the previous user. This wipes every `sb-` cookie defensively
 * on the cross-subdomain scope so AVI, Suite and CRM all start clean.
 */
function wipeAllSupabaseCookies() {
  const store = cookies();
  for (const c of store.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    const opts: { path: string; expires: Date; domain?: string } = {
      path: "/",
      expires: new Date(0),
    };
    if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
    try { store.set(c.name, "", opts); } catch { /* read-only context — ignore */ }
  }
}

export async function POST() {
  const supabase = createServerClient();
  try { await supabase.auth.signOut(); } catch { /* fall through to manual wipe */ }
  wipeAllSupabaseCookies();
  return NextResponse.json({ ok: true });
}

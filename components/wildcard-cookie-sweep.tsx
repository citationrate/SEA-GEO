"use client";

import { useEffect } from "react";

/**
 * TEMPORARY one-shot cleanup — remove after ~2026-06-26 (3–4 weeks post-deploy).
 *
 * Why this exists: until the host-only fix, suite + AVI wrote the Supabase auth
 * cookies on the wildcard domain `.citationrate.com`. Those cookies are also sent
 * to the PHP apex (citationrate.com / www), where the combined `Cookie:` header
 * exceeds Aruba's ~8 KB limit → `400 Bad Request`. A user who already has the
 * wildcard cookie stays broken even after the code fix, because the apex can't
 * emit a `Set-Cookie ... Max-Age=0` (the 400 happens during header parsing,
 * before PHP runs). So the deletion must be issued from a host the broken user
 * can still reach — suite. / avi. on Vercel (higher header limits).
 *
 * The Supabase auth cookies are not HttpOnly, so client JS can delete them.
 * Deleting with an explicit `domain=.citationrate.com` removes ONLY the wildcard
 * cookie — the new host-only cookie (no Domain attribute) is a distinct entry in
 * the jar and is untouched, so the current session survives.
 */
export default function WildcardCookieSweep() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Only meaningful on the production *.citationrate.com hosts.
    if (!window.location.hostname.endsWith("citationrate.com")) return;

    const AUTH_COOKIE = /^(sb-.*-auth-token|sb-auth-auth-token|auth)(\.\d+)?$/;

    // Enumerate at runtime so every chunk name (.0/.1/…) is covered.
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (AUTH_COOKIE.test(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.citationrate.com; secure; samesite=lax`;
      }
    });
  }, []);

  return null;
}

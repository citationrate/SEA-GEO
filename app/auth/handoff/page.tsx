"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HandoffInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read tokens from the URL hash fragment (#access_token=…&refresh_token=…).
    // Hash fragments are NOT sent in the HTTP Referer header, server access
    // logs, or analytics URL captures — unlike query strings, which leaked
    // the JWT into GA4 via the dr= referrer. Legacy query-string callers
    // still work during the rollout window; remove the fallback once the
    // suite deploy that emits hash fragments is fully live.
    const hashRaw = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hashRaw);

    let accessToken = hashParams.get("access_token");
    let refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      accessToken = params.get("access_token");
      refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        console.warn("[handoff] tokens received via query string — sender should be updated to use hash fragment (security)");
      }
    }

    // Optional deep-link target. Must be a same-origin path ("/..." with no
    // protocol-relative slashes) — everything else falls back to /dashboard.
    const fallbackNext = (() => {
      const raw = params.get("next");
      return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
    })();

    if (!accessToken || !refreshToken) {
      // Nessun token nell'URL: l'utente sta probabilmente ricaricando una
      // pagina di handoff vecchia o atterrando qui via link diretto. Non
      // serve un messaggio di errore — se ha già una sessione valida il
      // middleware lo lascerà passare, altrimenti lo redirigerà al login.
      // Meglio dell'attuale "Torna su suite e riprova" che lascia l'utente
      // bloccato senza CTA chiaro.
      console.warn("[handoff] no tokens in URL — falling through to", fallbackNext);
      window.location.replace(fallbackNext);
      return;
    }

    // Scrub the tokens from the visible URL before doing anything else, so
    // they don't sit in window.location while setSession runs and so the
    // handoff URL in browser history doesn't expose them.
    if (typeof window !== "undefined" && (window.location.hash || params.get("access_token"))) {
      const cleanQuery = new URLSearchParams(window.location.search);
      cleanQuery.delete("access_token");
      cleanQuery.delete("refresh_token");
      const qs = cleanQuery.toString();
      history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }

    // fallbackNext computed above already validates same-origin.
    const safeNext: string | null = fallbackNext === "/dashboard" ? null : fallbackNext;

    // Use the same singleton client the whole app uses
    const supabase = createClient();

    // Hardening: clear any local session state BEFORE adopting the new one.
    // Without this, residual chunked cookies from a previous account on the
    // same browser can survive (signOut local wipes the browser's view of
    // sb-auth-* cookies) and contaminate the new identity. scope:'local'
    // does NOT invalidate the new refresh_token on the server.
    supabase.auth.signOut({ scope: "local" })
      .catch(() => { /* nothing to sign out from — fine */ })
      .finally(() => {
        supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! })
          .then(async ({ data, error: err }) => {
            if (err || !data.session) {
              console.error("[handoff] setSession failed:", err?.message);
              setError("Sessione non valida. Riprova il login.");
              return;
            }
            // Race-condition hardening: setSession() returns *before* the
            // browser has committed the new `sb-auth-auth-token` cookie.
            // If we redirect immediately the AVI middleware sees "no
            // session" on the next-page request and bounces the user back
            // to suite.citationrate.com (i.e. the login page). Poll
            // document.cookie until the auth cookie is visible, then
            // navigate. Capped at ~1s — if the cookie never lands we
            // proceed anyway and let the destination handle the 401.
            const cookieReady = await new Promise<boolean>((resolve) => {
              let attempts = 0;
              const tick = () => {
                if (typeof document !== "undefined" &&
                    /(?:^|; )sb-auth-auth-token(?:\.\d+)?=/.test(document.cookie)) {
                  resolve(true);
                  return;
                }
                if (attempts++ >= 20) { resolve(false); return; }
                setTimeout(tick, 50);
              };
              tick();
            });
            console.log(
              "[handoff] Session set OK (cookie ready =",
              cookieReady,
              "), redirecting to",
              safeNext || "/dashboard"
            );
            // replace() instead of href= so the handoff URL doesn't sit in
            // browser history (defense in depth even though tokens are
            // already scrubbed via replaceState above).
            window.location.replace(safeNext || "/dashboard");
          });
      });
  }, [params, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <a href="https://suite.citationrate.com" className="text-sm text-primary underline">Torna a CitationRate</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center space-y-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Accesso in corso...</p>
      </div>
    </div>
  );
}

export default function AuthHandoff() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HandoffInner />
    </Suspense>
  );
}

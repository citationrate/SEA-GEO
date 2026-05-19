"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HandoffInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
      const rawNext = params.get("next");
      const fallbackNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
      const safeNext: string | null = fallbackNext === "/dashboard" ? null : fallbackNext;

      if (!accessToken || !refreshToken) {
        // Nessun token nell'URL: l'utente sta probabilmente ricaricando una
        // pagina di handoff vecchia o atterrando qui via link diretto. Non
        // serve un messaggio di errore — se ha già una sessione valida il
        // middleware lo lascerà passare, altrimenti lo redirigerà al login.
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

      const supabase = createClient();

      // Decode the new token's user id so we can detect "same user" handoff
      // (es. ToolSwitcher) vs "different user" handoff (logout + relogin
      // from another account on the same browser).
      const decodeJwtSub = (token: string): string | null => {
        try {
          const parts = token.split(".");
          if (parts.length !== 3) return null;
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          return typeof payload?.sub === "string" ? payload.sub : null;
        } catch { return null; }
      };
      const newUserId = decodeJwtSub(accessToken);
      const { data: { session: existing } } = await supabase.auth.getSession();
      const sameUser = !!(existing?.user?.id && newUserId && existing.user.id === newUserId);

      // Hardening signOut: clear residual chunked cookies from a previous
      // identity ONLY when we're switching account. For same-user handoff
      // (ToolSwitcher) the signOut + setSession-fail combo would kick the
      // user out for nothing — skip it. Critical: this fixed the "passando
      // da uno strumento all'altro mi ha fatto uscire" bug.
      if (!sameUser) {
        try { await supabase.auth.signOut({ scope: "local" }); } catch {}
      }

      const { data, error: setErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      const newSessionOk = !!(data?.session) && !setErr;

      if (!newSessionOk) {
        // Fallback: se setSession fallisce ma c'era una session valida dello
        // stesso utente, andiamo avanti con quella — meglio che kickare fuori.
        if (sameUser && existing) {
          console.warn("[handoff] setSession failed, using existing same-user session:", setErr?.message);
        } else {
          console.error("[handoff] setSession failed:", setErr?.message);
          setError("Sessione non valida. Riprova il login.");
          return;
        }
      }

      // Race-condition hardening: setSession() returns *before* the browser
      // has committed the new sb-auth-auth-token cookie. If we redirect
      // immediately the AVI middleware sees "no session" on the next-page
      // request and bounces the user back to suite.citationrate.com (= login
      // page). Poll document.cookie until the auth cookie is visible, then
      // navigate. Capped at ~1s.
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
        "[handoff] sameUser=", sameUser,
        " newSessionOk=", newSessionOk,
        " cookieReady=", cookieReady,
        " → redirecting to", safeNext || "/dashboard"
      );
      window.location.replace(safeNext || "/dashboard");
    })();
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

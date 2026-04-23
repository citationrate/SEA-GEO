"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HandoffInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Token mancanti. Torna su suite.citationrate.com e riprova.");
      return;
    }

    // Optional deep-link target. Must be a same-origin path ("/..." with no
    // protocol-relative slashes) — everything else falls back to /dashboard.
    const rawNext = params.get("next");
    const safeNext =
      rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : null;

    // Use the same singleton client the whole app uses
    const supabase = createClient();

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error: err }) => {
        if (err || !data.session) {
          console.error("[handoff] setSession failed:", err?.message);
          setError("Sessione non valida. Riprova il login.");
          return;
        }
        console.log("[handoff] Session set OK, redirecting to", safeNext || "/dashboard");
        // Use window.location for a full page load (not client-side navigation)
        window.location.href = safeNext || "/dashboard";
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

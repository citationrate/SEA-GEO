"use client";

/**
 * Seed suite→AVI (A1 + BX). L'utente arriva qui dal bridge della suite dopo
 * aver creato/confermato il progetto canonico. Generalizza /demo-setup a TUTTI
 * i piani:
 *  1. Idempotenza: se esiste già un progetto AVI mappato al canonico → vai lì.
 *  2. Crea il progetto AVI (modelli di default per piano) collegato al canonico.
 *  3. Auto-genera le query (BX) così l'utente atterra pronto a lanciare.
 *  4. Redirect alla dashboard del progetto — NESSUN auto-lancio (l'analisi
 *     parte solo col click esplicito su "Lancia Analisi", rispetta i crediti).
 *
 * Niente creazione progetto manuale in AVI: il progetto nasce nella suite.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";

type Phase = "starting" | "creating_project" | "redirecting" | "error";

const PHASE_COPY: Record<Phase, string> = {
  starting: "Preparo il tuo progetto...",
  creating_project: "Configuro l'analisi AI...",
  redirecting: "Quasi pronto...",
  error: "Qualcosa è andato storto",
};

// Modelli di default per piano (hardcoded come in /demo-setup, per non
// dipendere da @citationrate/llm-client lato client). Tutti del pool base, così
// non superano mai il cap del piano (base 3). L'utente può modificarli in AVI.
const DEMO_MODELS = ["gpt-5.4-mini", "gemini-2.5-flash", "claude-haiku", "perplexity-sonar"];
const DEFAULT_MODELS = ["gpt-5.4-mini", "gemini-2.5-flash", "claude-haiku"];
const VALID_LANGS = new Set(["it", "en", "fr", "de", "es"]);

function track(event: string, metadata: Record<string, unknown> = {}) {
  import("@/lib/tracking").then(({ trackEvent }) => trackEvent(event, "avi", metadata)).catch(() => {});
}

function StartInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const canonical = (sp.get("canonical") || "").trim();
  const brand = (sp.get("brand") || "").trim();
  const websiteUrl = (sp.get("url") || "").trim();
  const country = (sp.get("country") || "IT").trim();
  const langParam = (sp.get("lang") || "").trim().toLowerCase();
  const sector = (sp.get("sector") || "").trim();
  const competitorsParam = (sp.get("competitors") || "").trim();

  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!brand) {
      setPhase("error");
      setErrorMsg("Dati del progetto mancanti. Torna alla suite e riprova.");
      return;
    }
    void run();

    async function run() {
      track("avi_seed_started", { brand, canonical });
      try {
        // 0) Idempotenza: progetto AVI già mappato a questo canonico?
        if (canonical) {
          const existRes = await fetch(`/api/projects?canonical=${encodeURIComponent(canonical)}`, {
            credentials: "same-origin", cache: "no-store",
          });
          if (existRes.ok) {
            const ex = await existRes.json().catch(() => ({}));
            const existingId: string | undefined = ex?.project?.id;
            if (existingId) {
              setPhase("redirecting");
              track("avi_seed_existing", { project_id: existingId });
              router.replace(`/dashboard?projectId=${existingId}`);
              return;
            }
          }
        }

        // Piano → modelli di default.
        let planId = "demo";
        try {
          const pr = await fetch("/api/usage", { credentials: "same-origin", cache: "no-store" });
          if (pr.ok) planId = (await pr.json())?.planId ?? "demo";
        } catch { /* default demo */ }
        const models = planId === "demo" ? DEMO_MODELS : DEFAULT_MODELS;
        const queryCount = planId === "demo" ? 2 : 5;
        const language = VALID_LANGS.has(langParam) ? langParam : "it";
        const competitors = competitorsParam ? competitorsParam.split(",").map((c) => c.trim()).filter(Boolean) : [];

        // 1) Crea progetto AVI collegato al canonico.
        setPhase("creating_project");
        const createRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: brand,
            target_brand: brand,
            website_url: websiteUrl || null,
            language,
            known_competitors: competitors,
            market_context: null,
            country: country || null,
            sector: sector || null,
            brand_type: null,
            models_config: models,
            site_analysis: null,
            canonical_project_id: canonical || null,
          }),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.error || `Errore creazione progetto (${createRes.status})`);
        }
        const projectId: string | undefined = (await createRes.json())?.id;
        if (!projectId) throw new Error("ID progetto mancante");
        track("avi_seed_project_created", { project_id: projectId, plan: planId });

        // 2) Genera le query in BACKGROUND. `keepalive: true` fa sopravvivere
        // la richiesta alla navigazione, così NON mostriamo il loader di
        // generazione e l'utente atterra subito sulla dashboard. Le query
        // compaiono in pochi secondi (endpoint server-side combinato gen+save).
        try {
          fetch("/api/queries/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            keepalive: true,
            body: JSON.stringify({ project_id: projectId, count: queryCount }),
          }).catch(() => {});
        } catch { /* ignore */ }
        track("avi_seed_queries_bg", { project_id: projectId });

        // 3) Subito alla dashboard del progetto, pronta al lancio.
        setPhase("redirecting");
        router.replace(`/dashboard?projectId=${projectId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        track("avi_seed_failed", { error: msg });
        setPhase("error");
        setErrorMsg(msg);
      }
    }
    // params letti una volta sola al mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full text-center space-y-5">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="font-display text-2xl font-semibold">Non è stato possibile preparare il progetto</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-border text-sm hover:bg-card/40 transition-colors"
          >
            Vai alla dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mx-auto">
          {phase === "redirecting" ? (
            <Sparkles className="w-6 h-6 text-emerald-500" />
          ) : (
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          )}
        </div>
        <h1 className="font-display text-2xl font-semibold">{PHASE_COPY[phase]}</h1>
        {brand && (
          <p className="text-sm text-muted-foreground">
            Stiamo preparando l&apos;analisi AI per <strong className="text-foreground">{brand}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <StartInner />
    </Suspense>
  );
}

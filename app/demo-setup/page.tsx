"use client";

/**
 * Demo auto-setup: l'utente arriva qui dal popup post-CS su suite.
 * Saltiamo completamente la wizard di /projects/new + /queries/generate
 * per eliminare l'attrito cognitivo del cambio prodotto.
 *
 * Sequenza (tutta server-side via API esistenti):
 *  1. Crea progetto AVI con i 4 motori demo (T3)
 *  2. Inserisce 2 query brand-centric hardcoded
 *  3. Lancia l'analisi (no browsing perché demo lo blocca)
 *  4. Redirect a /projects/{id} → l'utente vede direttamente il loader
 *     dell'analisi e poi il run report con il LockedPreviewCta (T4)
 *
 * Resilienza: se qualunque step fallisce, mostriamo errore + CTA per
 * tornare al flow manuale (/projects/new pre-fill). Tracking integrato
 * a ogni step così possiamo misurare dove cade.
 *
 * Compliance: nessun cookie aggiuntivo scritto, eventi vanno su
 * user_events (analytics di prodotto, legittimo interesse Art. 6.1.f).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";

type Phase = "starting" | "creating_project" | "adding_queries" | "launching" | "redirecting" | "error";

const PHASE_COPY: Record<Phase, string> = {
  starting: "Preparo la tua demo...",
  creating_project: "Creo il progetto AVI...",
  adding_queries: "Aggiungo le query di analisi...",
  launching: "Lancio l'analisi su 4 motori AI...",
  redirecting: "Quasi pronto...",
  error: "Qualcosa è andato storto",
};

function trackDemoStep(event: string, metadata: Record<string, unknown> = {}) {
  import("@/lib/tracking").then(({ trackEvent }) =>
    trackEvent(event, "avi", metadata)
  ).catch(() => {});
}

function DemoSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brand = (searchParams.get("brand") || "").trim();
  const websiteUrl = (searchParams.get("url") || "").trim();
  const source = searchParams.get("source") || "cs-audit-popup";
  const auditId = searchParams.get("audit_id") || undefined;

  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Strict-Mode guard: in dev React monta il componente 2x. Evitiamo che la
  // sequenza di setup parta due volte e crei progetti duplicati.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!brand) {
      setPhase("error");
      setErrorMsg("Brand mancante. Torna sul report Citability Score e riprova.");
      return;
    }

    void runSetup();

    async function runSetup() {
      trackDemoStep("avi_demo_setup_started", { brand, source, audit_id: auditId });

      try {
        // 0) Plan gate: la route auto-flow è pensata SOLO per piano demo.
        // Utenti Base/Pro ci atterrerebbero con un progetto pre-configurato a
        // 4 modelli demo (fixed) invece dei loro modelli — strano per loro.
        // Reindirizziamo al flow manuale /projects/new col pre-fill, così
        // mantengono pieno controllo sulla configurazione.
        const profileRes = await fetch("/api/usage", { credentials: "same-origin", cache: "no-store" });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const planId: string = profile?.planId ?? "demo";
          if (planId !== "demo") {
            trackDemoStep("avi_demo_setup_redirected_non_demo", { plan_id: planId, brand });
            const fallbackQs = new URLSearchParams();
            if (brand) fallbackQs.set("brand", brand);
            if (websiteUrl) fallbackQs.set("url", websiteUrl);
            if (source) fallbackQs.set("source", source);
            if (auditId) fallbackQs.set("audit_id", auditId);
            router.replace(`/projects/new?${fallbackQs.toString()}`);
            return;
          }
        }

        // 1) Crea progetto AVI
        setPhase("creating_project");
        const projectName = brand;
        const createRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: projectName,
            target_brand: brand,
            website_url: websiteUrl || null,
            language: "it",
            known_competitors: [],
            market_context: null,
            country: "IT",
            sector: null,
            brand_type: null,
            // 4 motori demo (T3). Hard-coded così il flow non dipende da
            // import di @citationrate/llm-client (vivo lato server).
            models_config: ["gpt-5.4-mini", "gemini-2.5-flash", "claude-haiku", "perplexity-sonar"],
            site_analysis: null,
          }),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error(err.error || `Errore creazione progetto (${createRes.status})`);
        }
        const proj = await createRes.json();
        const projectId: string = proj.id;
        if (!projectId) throw new Error("ID progetto mancante");
        trackDemoStep("avi_demo_project_created", { project_id: projectId, brand });

        // 2) Genera 8 query AI sull'AMBITO del sito (non sul brand).
        // L'endpoint ai-generate ha prompt esplicito anti-brand: ritorna
        // query "Quali aziende offrono...", "Chi sono i migliori...", ecc.
        // — domande che un cliente potenziale userebbe su ChatGPT, senza
        // mai nominare il brand. Bypassa l'attrito di pensarle a mano.
        setPhase("adding_queries");
        const genRes = await fetch("/api/queries/ai-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            project_id: projectId,
            count: 8,
            mode: "generali",
            tofu_pct: 60,
          }),
        });
        if (!genRes.ok) {
          const err = await genRes.json().catch(() => ({}));
          throw new Error(err.error || `Errore generazione query (${genRes.status})`);
        }
        const genData = await genRes.json();
        const generatedQueries: Array<{ text: string; funnel_stage: "TOFU" | "MOFU" }> =
          Array.isArray(genData?.queries) ? genData.queries : [];
        if (generatedQueries.length === 0) {
          throw new Error("Nessuna query generata dall'AI");
        }
        let savedCount = 0;
        for (const q of generatedQueries) {
          // POST /api/queries vuole funnel_stage lowercase ("tofu"|"mofu"|"bofu").
          const stage = q.funnel_stage === "TOFU" ? "tofu" : "mofu";
          const qRes = await fetch("/api/queries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ project_id: projectId, text: q.text, funnel_stage: stage }),
          });
          // 409 (query già presente) è un no-op accettabile in caso di retry.
          if (qRes.ok || qRes.status === 409) savedCount++;
        }
        if (savedCount === 0) {
          throw new Error("Nessuna query salvata sul progetto");
        }
        trackDemoStep("avi_demo_queries_added", {
          project_id: projectId,
          generated: generatedQueries.length,
          saved: savedCount,
        });

        // 3) Lancia analisi (no browsing per demo plan)
        setPhase("launching");
        const startRes = await fetch("/api/analysis/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            project_id: projectId,
            run_count: 1,
            browsing: false,
            query_source: "plan",
          }),
        });
        if (!startRes.ok) {
          const err = await startRes.json().catch(() => ({}));
          throw new Error(err.error || `Errore avvio analisi (${startRes.status})`);
        }
        trackDemoStep("avi_demo_analysis_launched", { project_id: projectId });

        // 4) Redirect al progetto. La pagina mostra il run in corso e
        //    quando completa appare il LockedPreviewCta (T4).
        setPhase("redirecting");
        router.replace(`/projects/${projectId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        console.error("[demo-setup] failed:", msg);
        trackDemoStep("avi_demo_setup_failed", { error: msg, phase });
        setPhase("error");
        setErrorMsg(msg);
      }
    }
    // brand/url sono letti dalle URL params una sola volta: niente refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full text-center space-y-5">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="font-display text-2xl font-semibold">Demo non pronta</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={`/projects/new${brand ? `?brand=${encodeURIComponent(brand)}${websiteUrl ? `&url=${encodeURIComponent(websiteUrl)}` : ""}` : ""}`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/85 transition-colors"
            >
              Crea il progetto manualmente
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-border text-sm hover:bg-card/40 transition-colors"
            >
              Torna alla dashboard
            </a>
          </div>
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
            Stiamo lanciando la demo AVI per <strong className="text-foreground">{brand}</strong> su 4 motori AI.
          </p>
        )}
        <div className="pt-2 flex items-center justify-center gap-1.5">
          {(["creating_project", "adding_queries", "launching", "redirecting"] as Phase[]).map((p, i) => {
            const order = ["starting", "creating_project", "adding_queries", "launching", "redirecting"];
            const currentIdx = order.indexOf(phase);
            const stepIdx = order.indexOf(p);
            const done = stepIdx < currentIdx || phase === "redirecting";
            const active = stepIdx === currentIdx;
            return (
              <div
                key={p}
                className={`h-1 w-12 rounded-full transition-colors ${
                  done ? "bg-emerald-500" : active ? "bg-emerald-500/50 animate-pulse" : "bg-border"
                }`}
                aria-label={`Step ${i + 1}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DemoSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <DemoSetupInner />
    </Suspense>
  );
}

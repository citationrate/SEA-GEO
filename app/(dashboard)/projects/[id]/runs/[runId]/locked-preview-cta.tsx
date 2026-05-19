"use client";

/**
 * Locked-preview CTA shown to demo users at the bottom of an AVI run report.
 *
 * Trasforma la pagina risultati da cul-de-sac a trampolino verso il pricing:
 * mostra in modo tangibile cosa è bloccato (query extra, motori Pro-only,
 * comparazioni competitive) con un CTA grande verso /piano.
 *
 * Rendered only for plan === "demo". Base/Pro users non vedono nulla.
 *
 * Tracking: avi_locked_preview_shown (mount) + avi_locked_preview_clicked
 * (click sul CTA principale o secondario). Riusa `trackEvent` da lib/tracking
 * con tool='avi' per coerenza con gli altri eventi AVI.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  plan: string;
  runId: string;
  brand?: string;
  /** AVI score 0-100, se disponibile. Mostrato nel CTA per personalizzazione. */
  aviScore?: number | null;
}

const LOCKED_QUERIES_HINT: string[] = [
  "Quali sono i migliori brand del settore {brand}?",
  "Confronta {brand} con i suoi competitor diretti",
  "Quali sono i pro e i contro di {brand}?",
  "Recensioni e opinioni su {brand}",
];

const LOCKED_FEATURES = [
  { label: "Comparazioni con competitor", plan: "Base", icon: "⚔️" },
  { label: "Tracking dei cambiamenti nel tempo", plan: "Base", icon: "📈" },
  { label: "Motori Pro (Claude Opus, GPT-5.5, Gemini 3.1 Pro)", plan: "Pro", icon: "🚀" },
  { label: "Query con web browsing live", plan: "Base", icon: "🌐" },
];

export function LockedPreviewCta({ plan, runId, brand, aviScore }: Props) {
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    if (plan !== "demo" || hasTracked) return;
    setHasTracked(true);
    // Use dynamic import to avoid bundling tracking lib server-side
    import("@/lib/tracking").then(({ trackEvent }) =>
      trackEvent("avi_locked_preview_shown", "avi", {
        run_id: runId,
        brand: brand || undefined,
        avi_score: typeof aviScore === "number" ? aviScore : undefined,
      })
    ).catch(() => {});
  }, [plan, runId, brand, aviScore, hasTracked]);

  if (plan !== "demo") return null;

  const handleClick = (location: "primary" | "secondary" | "query_ghost") => {
    import("@/lib/tracking").then(({ trackEvent }) =>
      trackEvent("avi_locked_preview_clicked", "avi", {
        run_id: runId,
        cta_location: location,
        brand: brand || undefined,
      })
    ).catch(() => {});
  };

  const brandName = (brand && brand.trim()) || "il tuo brand";

  return (
    <section
      className="mt-10 rounded-lg border border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/10 p-6 md:p-8"
      aria-labelledby="locked-preview-title"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-emerald-500" />
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-500">
          La tua demo finisce qui
        </p>
      </div>

      <h2 id="locked-preview-title" className="text-2xl md:text-3xl font-semibold mb-3">
        Sblocca tutta l'analisi di {brandName}
      </h2>

      <p className="text-sm md:text-base text-muted-foreground mb-6 max-w-2xl leading-relaxed">
        Hai visto il tuo AVI{typeof aviScore === "number" ? <strong> {aviScore}/100</strong> : ""} su 2 query e 4 motori. Il piano Base ti dà
        100 query/mese, web browsing live, e tracking continuo dei cambiamenti.
      </p>

      {/* Ghost queries preview */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Query che potresti lanciare con Base
        </p>
        <ul className="space-y-2">
          {LOCKED_QUERIES_HINT.map((q, i) => (
            <li
              key={i}
              onClick={() => handleClick("query_ghost")}
              className="flex items-center gap-3 p-3 rounded-md border border-border bg-card/40 cursor-pointer transition-colors hover:bg-card/70 hover:border-emerald-500/30"
            >
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-sm text-muted-foreground blur-[2px] select-none">
                {q.replace("{brand}", brandName)}
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-500 font-mono whitespace-nowrap">
                Base →
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Locked features grid */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {LOCKED_FEATURES.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-3 p-3 rounded-md border border-border bg-card/40"
          >
            <span className="text-lg">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.label}</p>
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-500">
                Sblocca con {f.plan}
              </p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Link
          href="/piano?source=avi_locked_preview"
          onClick={() => handleClick("primary")}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-emerald-500 text-emerald-950 font-semibold text-sm uppercase tracking-wider hover:bg-emerald-400 transition-colors"
        >
          Sblocca tutto a €59/mese
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/piano?source=avi_locked_preview_secondary"
          onClick={() => handleClick("secondary")}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-border text-sm hover:bg-card/40 transition-colors"
        >
          Confronta i piani
        </Link>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground font-mono">
        Trial 7 giorni · Cancella in 1 click · Nessuna carta richiesta per la demo
      </p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

interface RunRow {
  id: string;
  brand_name: string;
  sector: string;
  country: string;
  locale: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_prompts: number;
  models: string[];
  error_message: string | null;
}

interface ScoreRow {
  recognition: number | null;
  clarity: number | null;
  authority: number | null;
  relevance: number | null;
  sentiment: number | null;
  total: number | null;
  breakdown: any;
}

interface PromptRow {
  pillar: string;
  prompt_index: number;
  model: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment_score: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

const PILLARS: Array<{ key: keyof Omit<ScoreRow, "total" | "breakdown">; label: string }> = [
  { key: "recognition", label: "Recognition" },
  { key: "clarity", label: "Clarity" },
  { key: "authority", label: "Authority" },
  { key: "relevance", label: "Relevance" },
  { key: "sentiment", label: "Sentiment" },
];

function scoreColor(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n <= 30) return "text-red-400";
  if (n <= 50) return "text-amber-400";
  if (n <= 70) return "text-sky-400";
  if (n <= 85) return "text-primary";
  return "text-emerald-400";
}

export function BrandProfileReport({
  runId,
  initialRun,
  initialScores,
  initialPrompts,
}: {
  runId: string;
  initialRun: RunRow;
  initialScores: ScoreRow | null;
  initialPrompts: PromptRow[];
}) {
  const [run, setRun] = useState<RunRow>(initialRun);
  const [scores, setScores] = useState<ScoreRow | null>(initialScores);
  const [prompts, setPrompts] = useState<PromptRow[]>(initialPrompts);

  const isPolling = run.status === "pending" || run.status === "running";
  const total = Number(scores?.total ?? 0);

  useEffect(() => {
    if (!isPolling) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/brand-profile/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setRun(json.run);
        setScores(json.scores);
      } catch { /* swallow */ }
    };
    const id = setInterval(tick, 4000);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [isPolling, runId]);

  const promptsByPillar = PILLARS.reduce<Record<string, PromptRow[]>>((acc, p) => {
    acc[p.key as string] = prompts.filter((r) => r.pillar === (p.key as string));
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/brand-profile"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Torna alle run
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            {run.brand_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {run.sector} · {run.country} · {run.models?.length ?? 0} modelli · {run.total_prompts} prompt
          </p>
        </div>
      </div>

      {run.status === "failed" && (
        <div className="card p-5 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold text-red-400">Run fallita</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {run.error_message ?? "Errore sconosciuto durante l'esecuzione."}
              </p>
            </div>
          </div>
        </div>
      )}

      {isPolling && (
        <div className="card p-5 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            <p className="text-sm text-foreground">
              Run in {run.status === "pending" ? "coda" : "esecuzione"}… aggiornamento ogni 4 secondi.
            </p>
          </div>
        </div>
      )}

      {scores && run.status === "completed" && (
        <>
          <div className="card p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Score complessivo</div>
                <div className={`font-display text-5xl font-bold ${scoreColor(total)}`}>
                  {Math.round(total)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">su 100</div>
              </div>
              <div className="flex-1 min-w-[280px] grid grid-cols-5 gap-3">
                {PILLARS.map((p) => {
                  const v = Number(scores[p.key] ?? 0);
                  return (
                    <div key={p.key} className="text-center">
                      <div className={`font-display text-2xl font-bold ${scoreColor(v)}`}>
                        {Math.round(v)}
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">
                        {p.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Radar visivo in arrivo — per ora valori grezzi e breakdown qui sotto.
            </p>
          </div>

          {scores.breakdown && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLARS.map((p) => {
                const sub = (scores.breakdown as any)?.[p.key as string];
                if (!sub) return null;
                return (
                  <div key={p.key} className="card p-5">
                    <h3 className="font-display font-semibold text-foreground mb-3">{p.label}</h3>
                    <ul className="space-y-2">
                      {Object.entries(sub).map(([k, v]) => (
                        <li key={k} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                          <span className={`font-mono ${scoreColor(Number(v))}`}>{Math.round(Number(v))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {prompts.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">
            Prompt eseguiti ({prompts.length})
          </h3>
          <div className="space-y-1 text-xs font-mono">
            {PILLARS.map((p) => {
              const list = promptsByPillar[p.key as string] ?? [];
              if (list.length === 0) return null;
              return (
                <div key={p.key} className="border-l-2 border-border pl-3 py-1.5">
                  <div className="text-foreground font-display text-sm font-semibold not-italic mb-1">{p.label}</div>
                  {list.map((r, i) => (
                    <div key={i} className="text-muted-foreground flex items-center gap-2">
                      <span className="text-foreground">[{r.prompt_index}]</span>
                      <span>{r.model}</span>
                      {r.error_message ? (
                        <span className="text-red-400">err: {String(r.error_message).slice(0, 60)}</span>
                      ) : (
                        <>
                          <span>mentioned={String(r.brand_mentioned)}</span>
                          {r.brand_position != null && <span>pos={r.brand_position}</span>}
                          {r.sentiment_score != null && <span>sent={Number(r.sentiment_score).toFixed(2)}</span>}
                          {r.duration_ms != null && <span>{r.duration_ms}ms</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

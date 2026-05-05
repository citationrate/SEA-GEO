"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { ScoreRadar } from "./score-radar";

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

const PILLAR_KEYS: Array<{ key: keyof Omit<ScoreRow, "total" | "breakdown">; tKey: string }> = [
  { key: "recognition", tKey: "brandProfile.pillarRecognition" },
  { key: "clarity", tKey: "brandProfile.pillarClarity" },
  { key: "authority", tKey: "brandProfile.pillarAuthority" },
  { key: "relevance", tKey: "brandProfile.pillarRelevance" },
  { key: "sentiment", tKey: "brandProfile.pillarSentiment" },
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
}: {
  runId: string;
  initialRun: RunRow;
  initialScores: ScoreRow | null;
}) {
  const { t } = useTranslation();
  const [run, setRun] = useState<RunRow>(initialRun);
  const [scores, setScores] = useState<ScoreRow | null>(initialScores);

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

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/brand-profile"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            {t("brandProfile.backToRuns")}
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            {run.brand_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {run.sector} · {run.country} · {run.models?.length ?? 0} {t("brandProfile.modelsLabel")} · {run.total_prompts} {t("brandProfile.promptsLabel")}
          </p>
        </div>
      </div>

      {run.status === "failed" && (
        <div className="card p-5 border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold text-red-400">{t("brandProfile.failedTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {run.error_message ?? t("brandProfile.failedFallback")}
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
              {run.status === "pending" ? t("brandProfile.pollingPending") : t("brandProfile.pollingRunning")}
            </p>
          </div>
        </div>
      )}

      {scores && run.status === "completed" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-6 lg:col-span-2">
              <ScoreRadar
                scores={{
                  recognition: Number(scores.recognition ?? 0),
                  clarity: Number(scores.clarity ?? 0),
                  authority: Number(scores.authority ?? 0),
                  relevance: Number(scores.relevance ?? 0),
                  sentiment: Number(scores.sentiment ?? 0),
                }}
                labels={{
                  recognition: t("brandProfile.pillarRecognition"),
                  clarity: t("brandProfile.pillarClarity"),
                  authority: t("brandProfile.pillarAuthority"),
                  relevance: t("brandProfile.pillarRelevance"),
                  sentiment: t("brandProfile.pillarSentiment"),
                }}
              />
            </div>
            <div className="card p-6 flex flex-col justify-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{t("brandProfile.scoreTotal")}</div>
              <div className={`font-display text-6xl font-bold leading-none ${scoreColor(total)}`}>
                {Math.round(total)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t("brandProfile.scoreOutOf")}</div>
              <div className="grid grid-cols-5 gap-2 mt-6">
                {PILLAR_KEYS.map((p) => {
                  const v = Number(scores[p.key] ?? 0);
                  return (
                    <div key={p.key} className="text-center">
                      <div className={`font-display text-lg font-bold ${scoreColor(v)}`}>
                        {Math.round(v)}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5 truncate">
                        {t(p.tKey)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {scores.breakdown && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLAR_KEYS.map((p) => {
                const sub = (scores.breakdown as any)?.[p.key as string];
                if (!sub) return null;
                return (
                  <div key={p.key} className="card p-5">
                    <h3 className="font-display font-semibold text-foreground mb-3">{t(p.tKey)}</h3>
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

    </>
  );
}

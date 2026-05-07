"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radar, ArrowLeft, Loader2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, Sparkles, Stethoscope, ExternalLink, Printer } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { ScoreRadar } from "./score-radar";
import { RunInProgressAnimation } from "./run-progress";

const CS_AUDIT_BASE = "https://suite.citationrate.com/audit";

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

interface InsightRow {
  pillar: string;
  insight_text: string;
}

interface PromptRow {
  pillar: string;
  prompt_index: number;
  prompt_text: string;
  model: string;
  response_raw: string | null;
  brand_mentioned: boolean | null;
  error_message: string | null;
}

interface DiagnosticRow {
  pillar: string;
  cs_parameter_id: string;
  cs_status: "fail" | "partial" | "pass";
  cs_audit_id: string;
  cs_audit_date: string;
  note: string | null;
}

const PILLAR_KEYS: Array<{ key: keyof Omit<ScoreRow, "total" | "breakdown">; tKey: string; descKey: string }> = [
  { key: "recognition", tKey: "brandProfile.pillarRecognition", descKey: "brandProfile.pillarDescRecognition" },
  { key: "clarity",     tKey: "brandProfile.pillarClarity",     descKey: "brandProfile.pillarDescClarity"     },
  { key: "authority",   tKey: "brandProfile.pillarAuthority",   descKey: "brandProfile.pillarDescAuthority"   },
  { key: "relevance",   tKey: "brandProfile.pillarRelevance",   descKey: "brandProfile.pillarDescRelevance"   },
  { key: "sentiment",   tKey: "brandProfile.pillarSentiment",   descKey: "brandProfile.pillarDescSentiment"   },
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
  initialInsights,
  initialPrompts,
  initialDiagnostics,
  canExport,
}: {
  runId: string;
  initialRun: RunRow;
  initialScores: ScoreRow | null;
  initialInsights: InsightRow[];
  initialPrompts: PromptRow[];
  initialDiagnostics: DiagnosticRow[];
  canExport: boolean;
}) {
  const { t } = useTranslation();
  const [run, setRun] = useState<RunRow>(initialRun);
  const [scores, setScores] = useState<ScoreRow | null>(initialScores);
  const [insights, setInsights] = useState<InsightRow[]>(initialInsights);
  const [prompts] = useState<PromptRow[]>(initialPrompts);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>(initialDiagnostics);
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });

  const isPolling = run.status === "pending" || run.status === "running";
  const total = Number(scores?.total ?? 0);
  const insightsLoading = scores != null && insights.length === 0 && run.status === "completed";

  useEffect(() => {
    if (!isPolling) return;
    let cancelled = false;
    // Ask for notification permission once so we can ping the user when the
    // run completes — they may have navigated away ("vai pure ad altro").
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => { /* user denied — no-op */ });
    }
    const previousStatus = run.status;
    const tick = async () => {
      try {
        const res = await fetch(`/api/brand-profile/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const nextStatus = json.run?.status as string | undefined;
        // Browser notification when the run flips to a terminal state and the
        // user is on a different tab.
        if (
          (nextStatus === "completed" || nextStatus === "failed") &&
          previousStatus !== nextStatus &&
          typeof document !== "undefined" &&
          document.visibilityState === "hidden" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(
              nextStatus === "completed"
                ? `Brand Profile pronto — ${json.run?.brand_name ?? ""}`
                : `Brand Profile fallito — ${json.run?.brand_name ?? ""}`,
              { body: window.location.href, icon: "/favicon.ico" },
            );
          } catch { /* notification API can throw on iframe / restricted contexts */ }
        }
        setRun(json.run);
        setScores(json.scores);
        if (Array.isArray(json.insights)) setInsights(json.insights);
        if (Array.isArray(json.diagnostics)) setDiagnostics(json.diagnostics);
        if (json.progress) setProgress(json.progress);
      } catch { /* swallow */ }
    };
    const id = setInterval(tick, 4000);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [isPolling, runId]);

  const insightsByPillar = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const i of insights) {
      if (!acc[i.pillar]) acc[i.pillar] = [];
      acc[i.pillar].push(i.insight_text);
    }
    return acc;
  }, [insights]);

  const promptsByPillar = useMemo(() => {
    const acc: Record<string, PromptRow[]> = {};
    for (const p of prompts) {
      if (!acc[p.pillar]) acc[p.pillar] = [];
      acc[p.pillar].push(p);
    }
    return acc;
  }, [prompts]);

  const diagnosticsByPillar = useMemo(() => {
    const acc: Record<string, DiagnosticRow[]> = {};
    for (const d of diagnostics) {
      if (!acc[d.pillar]) acc[d.pillar] = [];
      acc[d.pillar].push(d);
    }
    return acc;
  }, [diagnostics]);

  const hasDiagnostics = diagnostics.length > 0;
  const csAuditId = hasDiagnostics ? diagnostics[0].cs_audit_id : null;
  const csAuditDate = hasDiagnostics ? diagnostics[0].cs_audit_date : null;
  const showNoCSBanner = !hasDiagnostics && run.status === "completed";

  const canPrint = canExport && run.status === "completed" && scores != null;

  return (
    <div data-bp-print-area className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/brand-profile"
            data-bp-no-print
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
            {run.sector} · {run.country}
            {run.completed_at && (
              <> · <span className="font-mono">{run.completed_at.slice(0, 10)}</span></>
            )}
          </p>
        </div>
        {canPrint && (
          <button
            type="button"
            data-bp-no-print
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const { exportBrandProfilePdf } = await import("@/lib/brand-profile/export-pdf");
                await exportBrandProfilePdf({
                  brandName: run.brand_name,
                  date: run.completed_at ?? run.started_at,
                });
              } catch (e) {
                console.error("[bp/export-pdf]", e);
              } finally {
                setExporting(false);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-sm border border-border text-foreground hover:bg-surface-2 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            {exporting ? t("brandProfile.exportPdfBuilding") : t("brandProfile.exportPdf")}
          </button>
        )}
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
        <RunInProgressAnimation
          brand={run.brand_name}
          status={run.status as "pending" | "running"}
          completed={progress.completed}
          total={progress.total > 0 ? progress.total : run.total_prompts}
          locale={run.locale}
        />
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
            <div className="card p-6 flex flex-col">
              <div className="flex flex-col items-center text-center pb-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{t("brandProfile.scoreTotal")}</div>
                <div className={`font-display text-7xl font-bold leading-none mt-2 ${scoreColor(total)}`}>
                  {Math.round(total)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">{t("brandProfile.scoreOutOf")}</div>
              </div>
              <div className="border-t border-border pt-3">
                <ul className="space-y-1">
                  {PILLAR_KEYS.map((p) => {
                    const v = Number(scores[p.key] ?? 0);
                    const isOpen = openPillar === p.key;
                    const subBreakdown = (scores.breakdown as any)?.[p.key as string];
                    return (
                      <li key={p.key}>
                        <button
                          type="button"
                          onClick={() => setOpenPillar(isOpen ? null : (p.key as string))}
                          aria-expanded={isOpen}
                          className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-[2px] hover:bg-surface-2 transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                            />
                            <span className="text-sm text-foreground truncate">{t(p.tKey)}</span>
                          </span>
                          <span className={`font-mono font-semibold text-sm tabular-nums ${scoreColor(v)}`}>
                            {Math.round(v)}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-2 pt-1 pb-3 space-y-2">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t(p.descKey)}
                            </p>
                            {subBreakdown && (
                              <ul className="space-y-1 pt-1">
                                {Object.entries(subBreakdown).map(([k, vv]) => (
                                  <li key={k} className="flex items-center justify-between text-xs gap-3">
                                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                                    <span className={`font-mono tabular-nums ${scoreColor(Number(vv))}`}>
                                      {Math.round(Number(vv))}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {insightsLoading && (
            <div className="card p-5 border-primary/30 bg-primary/5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <p className="text-sm text-foreground">{t("brandProfile.insightsPending")}</p>
            </div>
          )}

          {hasDiagnostics && csAuditId && (
            <div className="card p-4 border-primary/30 bg-primary/5 flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-foreground flex-1">
                {t("brandProfile.csLinkedHeading")}{" "}
                <span className="text-muted-foreground">({csAuditDate})</span>
              </p>
              <a
                href={`${CS_AUDIT_BASE}/${csAuditId}`}
                target="_blank"
                rel="noopener noreferrer"
                data-bp-no-print
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t("brandProfile.csOpenAudit")}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {showNoCSBanner && (
            <div data-bp-no-print className="card p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
              <Stethoscope className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-foreground flex-1">{t("brandProfile.csEmptyHint")}</p>
              <a
                href="https://suite.citationrate.com/audit/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
              >
                {t("brandProfile.csRunAudit")}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PILLAR_KEYS.map((p) => {
              const sub = (scores.breakdown as any)?.[p.key as string];
              const tips = insightsByPillar[p.key as string] ?? [];
              const responses = promptsByPillar[p.key as string] ?? [];
              const diag = diagnosticsByPillar[p.key as string] ?? [];
              const v = Number(scores[p.key] ?? 0);
              return (
                <PillarCard
                  key={p.key}
                  title={t(p.tKey)}
                  score={v}
                  breakdown={sub}
                  insights={tips}
                  responses={responses}
                  diagnostics={diag}
                  insightsLoading={insightsLoading}
                  t={t}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function statusDot(status: "fail" | "partial" | "pass"): string {
  if (status === "fail") return "bg-red-400";
  if (status === "partial") return "bg-amber-400";
  return "bg-emerald-400";
}

function PillarCard({
  title,
  score,
  breakdown,
  insights,
  responses,
  diagnostics,
  insightsLoading,
  t,
}: {
  title: string;
  score: number;
  breakdown: any;
  insights: string[];
  responses: PromptRow[];
  diagnostics: DiagnosticRow[];
  insightsLoading: boolean;
  t: (key: string) => string;
}) {
  const [showResponses, setShowResponses] = useState(false);
  const failing = diagnostics.filter((d) => d.cs_status !== "pass");

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground text-lg">{title}</h3>
          {breakdown && (
            <ul className="space-y-1 mt-2">
              {Object.entries(breakdown).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between text-sm gap-4">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className={`font-mono ${scoreColor(Number(v))}`}>{Math.round(Number(v))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`font-display text-3xl font-bold ${scoreColor(score)} shrink-0`}>{Math.round(score)}</div>
      </div>

      {/* Insights */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t("brandProfile.whatToDo")}
          </span>
        </div>
        {insights.length > 0 ? (
          <ul className="space-y-2">
            {insights.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                <Sparkles className="w-3 h-3 text-primary mt-1 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : insightsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t("brandProfile.insightsPending")}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("brandProfile.noInsights")}</p>
        )}
      </div>

      {/* CS diagnostics */}
      {failing.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {t("brandProfile.csFindings")}
            </span>
          </div>
          <ul className="space-y-1.5">
            {failing.map((d) => (
              <li key={d.cs_parameter_id} className="flex items-start gap-2 text-sm leading-relaxed">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDot(d.cs_status)}`}
                  aria-hidden
                />
                <span className="text-foreground">
                  <span className="font-mono text-xs text-muted-foreground mr-1">{d.cs_parameter_id}</span>
                  {d.note ?? t(`brandProfile.csStatus_${d.cs_status}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw responses toggle */}
      {responses.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            data-bp-print-toggle
            onClick={() => setShowResponses((s) => !s)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showResponses ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showResponses ? t("brandProfile.hideRawResponses") : t("brandProfile.viewRawResponses")}
          </button>
          <div
            data-bp-print-expand
            style={{ display: showResponses ? "block" : "none" }}
            className="mt-3 space-y-3"
          >
            {responses.map((r, i) => (
              <div key={i} className="rounded-[2px] border border-border bg-surface-2/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {t("brandProfile.rawResponseFromModel")} <span className="text-foreground">{r.model}</span>
                  </span>
                  {r.brand_mentioned != null && (
                    <span className={r.brand_mentioned ? "text-emerald-400" : "text-muted-foreground"}>
                      {r.brand_mentioned ? "✓" : "—"}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mb-2 italic">{r.prompt_text}</p>
                {r.error_message ? (
                  <p className="text-red-400">{r.error_message}</p>
                ) : r.response_raw ? (
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{r.response_raw}</p>
                ) : (
                  <p className="text-muted-foreground">{t("brandProfile.rawResponseEmpty")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

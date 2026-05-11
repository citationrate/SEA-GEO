"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radar, ArrowLeft, Loader2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, Sparkles, Stethoscope, ExternalLink, Printer, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { ScoreRadar } from "./score-radar";
import { RunInProgressAnimation } from "./run-progress";

const CS_AUDIT_BASE = "https://suite.citationrate.com/audit";

interface RunRow {
  id: string;
  brand_name: string;
  brand_url: string | null;
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

function formatRunDate(iso: string): string {
  // Display run date with time (e.g. "2026-05-07 12:23"). Falls back to the
  // raw ISO string if the timestamp is malformed.
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${ymd} ${hm}`;
  } catch {
    return iso.slice(0, 10);
  }
}

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
  userPlan,
  isAdmin,
}: {
  runId: string;
  initialRun: RunRow;
  initialScores: ScoreRow | null;
  initialInsights: InsightRow[];
  initialPrompts: PromptRow[];
  initialDiagnostics: DiagnosticRow[];
  canExport: boolean;
  userPlan: string;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const [run, setRun] = useState<RunRow>(initialRun);
  const [scores, setScores] = useState<ScoreRow | null>(initialScores);
  const [insights, setInsights] = useState<InsightRow[]>(initialInsights);
  const [prompts] = useState<PromptRow[]>(initialPrompts);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>(initialDiagnostics);
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reRunning, setReRunning] = useState(false);
  const [reRunError, setReRunError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [csTriggerState, setCsTriggerState] = useState<"idle" | "triggering" | "triggered" | "error">("idle");
  const [csTriggerError, setCsTriggerError] = useState<string | null>(null);
  // Previous completed run for the same brand_name — used to detect
  // run-to-run variability and show the "score può variare" banner only
  // from the 2nd run onward, when at least one pillar moved > 10 pts.
  const [prevScores, setPrevScores] = useState<Pick<ScoreRow, "recognition" | "clarity" | "authority" | "relevance" | "sentiment"> | null>(null);
  const router = useRouter();

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

  // When a polling run transitions to completed/failed, refresh the
  // sidebar's runs counter (it pulls /api/brand-profile/quota on focus,
  // but we never lose focus if the user stays on this page during the
  // 1-2 min wait). router.refresh() re-renders the BP layout RSC tree
  // so bpRunsUsed jumps from N→N+1 the moment the run finishes.
  useEffect(() => {
    if (run.status === "completed" || run.status === "failed") {
      router.refresh();
    }
  }, [run.status, router]);

  // Pull previous completed run's scores for the same brand_name — used
  // for the variability banner. Triggered only when the current run is
  // completed and we have a brand name to query by.
  useEffect(() => {
    if (run.status !== "completed" || !run.brand_name) return;
    let cancelled = false;
    (async () => {
      try {
        const url = `/api/brand-profile/runs/previous?brand_name=${encodeURIComponent(run.brand_name)}&before=${encodeURIComponent(run.id)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setPrevScores(json?.scores ?? null);
      } catch { /* swallow — banner just won't render */ }
    })();
    return () => { cancelled = true; };
  }, [run.id, run.brand_name, run.status]);

  // Variability flag: at least one pillar moved by more than 10 pts vs
  // the previous run for the same brand. Threshold mirrors the empirical
  // ±10 pt swing we see on Authority/Relevance from web-search variance.
  const variability = useMemo(() => {
    if (!prevScores || !scores) return null;
    const keys: Array<keyof typeof prevScores> = [
      "recognition", "clarity", "authority", "relevance", "sentiment",
    ];
    const pairs = keys.map((k) => ({
      key: k as string,
      curr: Number((scores as any)[k] ?? 0),
      prev: Number((prevScores as any)[k] ?? 0),
    }));
    const drifted = pairs.filter((p) => Math.abs(p.curr - p.prev) > 10);
    if (drifted.length === 0) return null;
    return { drifted, max: Math.max(...drifted.map((p) => Math.abs(p.curr - p.prev))) };
  }, [scores, prevScores]);

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
  const isDemoUser = userPlan === "demo" || userPlan === "free";
  const csTriggerStorageKey = `bp-cs-trigger-${runId}`;

  const triggerCsAudit = useCallback(async () => {
    if (!run.brand_url) {
      setCsTriggerError(t("brandProfile.csTriggerNeedUrl"));
      setCsTriggerState("error");
      return;
    }
    setCsTriggerState("triggering");
    setCsTriggerError(null);
    try {
      // Get the user's Supabase session — same auth project as CR backend, so
      // the access_token works for both. Lazy-import the client to keep this
      // out of the initial bundle for cold renders.
      const sbMod = await import("@/lib/supabase/client");
      const sb = sbMod.createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) {
        setCsTriggerError(t("brandProfile.errorNetwork"));
        setCsTriggerState("error");
        return;
      }
      const CR_BACKEND = process.env.NEXT_PUBLIC_CR_BACKEND_URL ||
        (process.env.NODE_ENV === "development"
          ? "http://localhost:8000"
          : "https://citationrate-backend-production.up.railway.app");
      const res = await fetch(`${CR_BACKEND}/audit/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          brand: run.brand_name,
          topic: "",
          // KNOW = generic knowledge sector. The user can re-pick the proper
          // CS sector code from CS itself; we pass the BP free-text sector
          // as label for display.
          sector: "KNOW",
          sector_label: run.sector,
          urls: [run.brand_url],
          country: run.country,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCsTriggerError(
          err?.detail ?? `${res.status}: ${t("brandProfile.errorUnknown")}`,
        );
        setCsTriggerState("error");
        return;
      }
      // Don't await the SSE stream — the audit is queued/started immediately.
      // Cancel the reader so we don't keep the connection alive client-side.
      try { res.body?.getReader().cancel(); } catch {}
      try { localStorage.setItem(csTriggerStorageKey, "1"); } catch {}
      setCsTriggerState("triggered");
    } catch (e) {
      setCsTriggerError(e instanceof Error ? e.message : t("brandProfile.errorNetwork"));
      setCsTriggerState("error");
    }
  }, [run.brand_url, run.brand_name, run.sector, run.country, csTriggerStorageKey, t]);

  // Demo users: auto-fire the CS audit once the BP run is complete and we
  // know there's no recent CS audit to compare against. localStorage flag
  // makes this a one-shot per BP run id.
  useEffect(() => {
    if (!showNoCSBanner) return;
    if (!isDemoUser) return;
    if (csTriggerState !== "idle") return;
    let alreadyFired = false;
    try { alreadyFired = !!localStorage.getItem(csTriggerStorageKey); } catch {}
    if (alreadyFired) {
      setCsTriggerState("triggered");
      return;
    }
    void triggerCsAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNoCSBanner, isDemoUser]);

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
            {(run.completed_at ?? run.started_at) && (
              <> · <span className="font-mono">{formatRunDate(run.completed_at ?? run.started_at)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap" data-bp-no-print>
          {run.status === "completed" && run.brand_url && (
            <button
              type="button"
              disabled={reRunning}
              onClick={async () => {
                setReRunError(null);
                setReRunning(true);
                try {
                  const res = await fetch("/api/brand-profile/runs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      brand: run.brand_name,
                      brand_url: run.brand_url,
                      sector: run.sector,
                      country: run.country,
                      locale: run.locale,
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    setReRunError(json?.error ?? t("brandProfile.errorUnknown"));
                    setReRunning(false);
                    return;
                  }
                  router.push(`/brand-profile/${json.runId}`);
                } catch (e) {
                  setReRunError(e instanceof Error ? e.message : t("brandProfile.errorNetwork"));
                  setReRunning(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] md:min-h-0 rounded-[2px] text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-wait"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground, var(--background))",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-hover, var(--primary))";
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.opacity = "1";
              }}
            >
              {reRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {reRunning ? t("brandProfile.reRunRunning") : t("brandProfile.reRun")}
            </button>
          )}
          {canPrint && (
            <button
              type="button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const { exportBrandProfilePdf } = await import("@/lib/brand-profile/export-pdf");
                  // Map run + scores + insights into the PDF generator's
                  // shape. Sub-metrics come from scores.breakdown which is a
                  // free-form jsonb keyed by pillar — we surface only the
                  // numeric leaves and let the generator skip the section
                  // if empty.
                  // PDF labels — hard-coded per locale because the keys
                  // weren't in lib/i18n/translations.ts and t() falls back
                  // to the literal key (a truthy string), making the `||`
                  // fallback dead. Sub-metric labels share the same map.
                  // The 11 PDF labels + 12 sub-metric labels live here
                  // instead of bloating translations.ts with 115 keys.
                  type PdfLocale = "it" | "en" | "fr" | "de" | "es";
                  const lc: PdfLocale = (["it","en","fr","de","es"] as PdfLocale[])
                    .includes(run.locale as PdfLocale)
                    ? (run.locale as PdfLocale) : "it";
                  const PDF_LABELS: Record<PdfLocale, any> = {
                    it: {
                      productName: "Brand Profile",
                      overallScore: "Score complessivo",
                      pillarsAtAGlance: "I 5 pilastri",
                      cosaFare: "Cosa fare",
                      page: "Pagina",
                      of: "di",
                      radarTitle: "Radar dei pilastri",
                      scoreLabelCritical: "Critico",
                      scoreLabelLow: "Basso",
                      scoreLabelMedium: "Moderato",
                      scoreLabelGood: "Buono",
                      scoreLabelExcellent: "Eccellente",
                    },
                    en: {
                      productName: "Brand Profile",
                      overallScore: "Overall score",
                      pillarsAtAGlance: "5 pillars at a glance",
                      cosaFare: "What to do",
                      page: "Page",
                      of: "of",
                      radarTitle: "Pillars radar",
                      scoreLabelCritical: "Critical",
                      scoreLabelLow: "Low",
                      scoreLabelMedium: "Medium",
                      scoreLabelGood: "Good",
                      scoreLabelExcellent: "Excellent",
                    },
                    fr: {
                      productName: "Brand Profile",
                      overallScore: "Score global",
                      pillarsAtAGlance: "Les 5 piliers",
                      cosaFare: "À faire",
                      page: "Page",
                      of: "sur",
                      radarTitle: "Radar des piliers",
                      scoreLabelCritical: "Critique",
                      scoreLabelLow: "Faible",
                      scoreLabelMedium: "Moyen",
                      scoreLabelGood: "Bon",
                      scoreLabelExcellent: "Excellent",
                    },
                    de: {
                      productName: "Brand Profile",
                      overallScore: "Gesamt-Score",
                      pillarsAtAGlance: "Die 5 Pillars",
                      cosaFare: "Maßnahmen",
                      page: "Seite",
                      of: "von",
                      radarTitle: "Pillar-Radar",
                      scoreLabelCritical: "Kritisch",
                      scoreLabelLow: "Niedrig",
                      scoreLabelMedium: "Mittel",
                      scoreLabelGood: "Gut",
                      scoreLabelExcellent: "Hervorragend",
                    },
                    es: {
                      productName: "Brand Profile",
                      overallScore: "Puntuación global",
                      pillarsAtAGlance: "Los 5 pilares",
                      cosaFare: "Qué hacer",
                      page: "Página",
                      of: "de",
                      radarTitle: "Radar de pilares",
                      scoreLabelCritical: "Crítico",
                      scoreLabelLow: "Bajo",
                      scoreLabelMedium: "Medio",
                      scoreLabelGood: "Bueno",
                      scoreLabelExcellent: "Excelente",
                    },
                  };
                  const SUB_METRIC_LABELS: Record<PdfLocale, Record<string, string>> = {
                    it: {
                      recognition_position: "Posizione",
                      recognition_presence: "Presenza",
                      clarity_factual: "Fatti corretti",
                      clarity_no_confusion: "Niente confusione",
                      authority_tone: "Tono autorevole",
                      authority_presence: "Citato come fonte",
                      relevance_coherence: "Coerenza",
                      relevance_product_match: "Match prodotti",
                      sentiment_tone: "Tono",
                      sentiment_sentiment: "Sentiment",
                      sentiment_recommendation: "Raccomandazione",
                    },
                    en: {
                      recognition_position: "Position",
                      recognition_presence: "Presence",
                      clarity_factual: "Factual accuracy",
                      clarity_no_confusion: "No confusion",
                      authority_tone: "Authoritative tone",
                      authority_presence: "Cited as source",
                      relevance_coherence: "Coherence",
                      relevance_product_match: "Product match",
                      sentiment_tone: "Tone",
                      sentiment_sentiment: "Sentiment",
                      sentiment_recommendation: "Recommendation",
                    },
                    fr: {
                      recognition_position: "Position",
                      recognition_presence: "Présence",
                      clarity_factual: "Précision factuelle",
                      clarity_no_confusion: "Aucune confusion",
                      authority_tone: "Ton d'autorité",
                      authority_presence: "Cité comme source",
                      relevance_coherence: "Cohérence",
                      relevance_product_match: "Correspondance produits",
                      sentiment_tone: "Ton",
                      sentiment_sentiment: "Sentiment",
                      sentiment_recommendation: "Recommandation",
                    },
                    de: {
                      recognition_position: "Position",
                      recognition_presence: "Präsenz",
                      clarity_factual: "Faktische Genauigkeit",
                      clarity_no_confusion: "Keine Verwechslung",
                      authority_tone: "Autoritativer Ton",
                      authority_presence: "Als Quelle zitiert",
                      relevance_coherence: "Kohärenz",
                      relevance_product_match: "Produktübereinstimmung",
                      sentiment_tone: "Ton",
                      sentiment_sentiment: "Sentiment",
                      sentiment_recommendation: "Empfehlung",
                    },
                    es: {
                      recognition_position: "Posición",
                      recognition_presence: "Presencia",
                      clarity_factual: "Precisión factual",
                      clarity_no_confusion: "Sin confusión",
                      authority_tone: "Tono autoritativo",
                      authority_presence: "Citado como fuente",
                      relevance_coherence: "Coherencia",
                      relevance_product_match: "Coincidencia productos",
                      sentiment_tone: "Tono",
                      sentiment_sentiment: "Sentimiento",
                      sentiment_recommendation: "Recomendación",
                    },
                  };
                  const subMetricMap = SUB_METRIC_LABELS[lc];
                  const pdfPillars = PILLAR_KEYS.map((p) => {
                    const sub = (scores?.breakdown as any)?.[p.key as string] ?? {};
                    const subMetrics: Array<{ label: string; value: number }> = [];
                    for (const [k, v] of Object.entries(sub)) {
                      if (typeof v === "number" && Number.isFinite(v)) {
                        subMetrics.push({
                          label: subMetricMap[`${p.key}_${k}`] ?? k,
                          value: Number(v),
                        });
                      }
                    }
                    return {
                      title: t(p.tKey),
                      description: t(p.descKey),
                      score: Number((scores as any)?.[p.key] ?? 0),
                      subMetrics,
                      insights: insightsByPillar[p.key as string] ?? [],
                    };
                  });
                  await exportBrandProfilePdf({
                    brandName: run.brand_name,
                    sector: run.sector,
                    country: run.country,
                    locale: run.locale,
                    date: run.completed_at ?? run.started_at,
                    scoreTotal: Number(scores?.total ?? 0),
                    pillars: pdfPillars,
                    labels: PDF_LABELS[lc],
                  });
                } catch (e) {
                  console.error("[bp/export-pdf]", e);
                } finally {
                  setExporting(false);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[44px] md:min-h-0 rounded-[2px] text-sm border border-border text-foreground hover:bg-surface-2 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              {exporting ? t("brandProfile.exportPdfBuilding") : t("brandProfile.exportPdf")}
            </button>
          )}
        </div>
      </div>

      {reRunError && (
        <div className="card p-4 border-red-500/40 bg-red-500/5 flex items-start gap-3" data-bp-no-print>
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground flex-1">{reRunError}</p>
        </div>
      )}

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

      {scores && run.status === "completed" && variability && (
        <div
          data-bp-no-print
          className="card p-4 border-amber-500/30 bg-amber-500/[0.04] flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <div className="font-medium mb-1">
              {t("brandProfile.variabilityTitle") || "I punteggi possono variare tra run consecutive"}
            </div>
            <div className="text-muted-foreground text-xs leading-relaxed">
              {t("brandProfile.variabilityBody") ||
                "Almeno un pilastro è cambiato di più di 10 punti rispetto alla run precedente per questo brand. È un comportamento intrinseco di alcuni motori AI (in particolare quelli con web search live, come Perplexity Sonar): le loro risposte cambiano leggermente da una run all'altra. Lo score complessivo resta stabile entro ±5 pt sui brand maturi."}
            </div>
          </div>
        </div>
      )}

      {scores && run.status === "completed" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-6 lg:col-span-2" data-bp-print-radar>
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
            <div data-bp-no-print>
              {csTriggerState === "triggering" && (
                <div className="card p-4 border-primary/30 bg-primary/5 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin" />
                  <p className="text-sm text-foreground flex-1">
                    {isDemoUser ? t("brandProfile.csTriggerDemoStarting") : t("brandProfile.csTriggerStarting")}
                  </p>
                </div>
              )}
              {csTriggerState === "triggered" && (
                <div className="card p-4 border-primary/40 bg-primary/[0.06] flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm text-foreground flex-1">
                    {isDemoUser ? t("brandProfile.csTriggerDemoSuccess") : t("brandProfile.csTriggerSuccess")}
                  </p>
                  <a
                    href="https://suite.citationrate.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                  >
                    {t("brandProfile.csTriggerOpenCS")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {csTriggerState === "error" && (
                <div className="card p-4 border-red-500/40 bg-red-500/5 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{csTriggerError ?? t("brandProfile.errorUnknown")}</p>
                    {!isDemoUser && (
                      <button
                        type="button"
                        onClick={() => { void triggerCsAudit(); }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        {t("brandProfile.csTriggerRetry")}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {csTriggerState === "idle" && !isDemoUser && (
                <div className="card p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
                  <Stethoscope className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-sm text-foreground flex-1">
                    {t("brandProfile.csTriggerPaidPrompt")}
                  </p>
                  <button
                    type="button"
                    onClick={() => { void triggerCsAudit(); }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-xs font-semibold transition-colors"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground, var(--background))",
                    }}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    {t("brandProfile.csTriggerPaidCta")}
                  </button>
                </div>
              )}
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
                  isAdmin={isAdmin}
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

// PillarCard is memoized: the parent re-renders every 4s while polling and
// nothing on the cards changes once the run is completed. Skipping these
// re-renders is cheap-but-meaningful given each card runs through ~5
// children + a status filter loop.
const PillarCard = memo(function PillarCard({
  title,
  score,
  breakdown,
  insights,
  responses,
  diagnostics,
  insightsLoading,
  isAdmin,
  t,
}: {
  title: string;
  score: number;
  breakdown: any;
  insights: string[];
  responses: PromptRow[];
  diagnostics: DiagnosticRow[];
  insightsLoading: boolean;
  isAdmin: boolean;
  t: (key: string) => string;
}) {
  const [showResponses, setShowResponses] = useState(false);
  // diagnostics are intentionally not surfaced inline anymore — the user
  // wanted P-codes/parameter-name leakage out of the BP UI. The CS deep-link
  // banner at the top of the report covers the "go see specifics" path.

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
                <InsightBullet text={s} />
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

      {/* Raw AI responses — admin-only. The plain user doesn't need to see
          the verbatim AI text; the takeaway is in the "Cosa fare" insights
          above. Admins keep access for QA / debugging. */}
      {isAdmin && responses.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            data-bp-print-toggle
            onClick={() => setShowResponses(true)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            {t("brandProfile.viewRawResponses")}
          </button>
          {/* Hidden duplicate so PDF export still includes the responses. */}
          <div data-bp-print-expand style={{ display: "none" }} className="mt-3 space-y-3 print:!block">
            {responses.map((r, i) => <RawResponseCard key={i} r={r} t={t} />)}
          </div>
        </div>
      )}

      {showResponses && (
        <RawResponsesModal title={title} responses={responses} onClose={() => setShowResponses(false)} t={t} />
      )}
    </div>
  );
});

/**
 * "Cosa fare" bullet with collapsible long text. Shows ~180 chars preview
 * + "…altro" toggle when the bullet exceeds the threshold. Splits the
 * preview at a word boundary so we never cut mid-word (the server-side
 * sanitize() already trims to ~600 chars at word boundary, this is the
 * second pass purely for layout).
 */
function InsightBullet({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LIMIT = 300;
  const needsTruncation = text.length > PREVIEW_LIMIT;
  const preview = useMemo(() => {
    if (!needsTruncation) return text;
    const sliced = text.slice(0, PREVIEW_LIMIT);
    const lastSpace = sliced.lastIndexOf(" ");
    const cut = lastSpace > PREVIEW_LIMIT * 0.7 ? lastSpace : PREVIEW_LIMIT;
    return text.slice(0, cut).trimEnd();
  }, [text, needsTruncation]);

  if (!needsTruncation) return <span>{text}</span>;
  return (
    <span>
      {expanded ? text : <>{preview}…</>}{" "}
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="text-xs text-primary hover:underline font-medium"
      >
        {expanded
          ? t("brandProfile.showLess") || "mostra meno"
          : t("brandProfile.showMore") || "altro"}
      </button>
    </span>
  );
}

function RawResponseCard({ r, t }: { r: PromptRow; t: (key: string) => string }) {
  return (
    <div className="rounded-[2px] border border-border bg-surface-2/50 p-3 text-xs">
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
  );
}

function RawResponsesModal({
  title,
  responses,
  onClose,
  t,
}: {
  title: string;
  responses: PromptRow[];
  onClose: () => void;
  t: (key: string) => string;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-foreground text-lg truncate">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t("brandProfile.rawResponsesModalSubtitle").replace("{n}", String(responses.length))}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors shrink-0"
            aria-label="Close"
          >
            <ChevronUp className="w-4 h-4 rotate-45" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {responses.map((r, i) => <RawResponseCard key={i} r={r} t={t} />)}
        </div>
      </div>
    </div>
  );
}

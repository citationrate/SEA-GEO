"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Swords, Trophy, Eye, BarChart3, Loader2, MessageSquare, TrendingUp, X } from "lucide-react";
import { MarkdownResponse } from "@/components/ui/markdown-response";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

const MODEL_LABELS: Record<string, string> = {
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "gpt-5.4": "GPT-5.4",
  "o1-mini": "o1 Mini",
  "o3-mini": "o3 Mini",
  "o3": "o3",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "perplexity-sonar": "Perplexity Sonar",
  "perplexity-sonar-pro": "Perplexity Sonar Pro",
  "claude-haiku": "Claude Haiku 4.5",
  "claude-sonnet": "Claude Sonnet 4.5",
  "claude-opus": "Claude Opus 4.5",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-opus-4-5": "Claude Opus 4.5",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
  "grok-2": "Grok 2",
  "copilot-gpt4": "Copilot GPT-4",
};

function getModelDisplayName(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

interface Analysis {
  id: string;
  brand_a: string;
  brand_b: string;
  driver: string;
  status: string;
  win_rate_a: number | null;
  win_rate_b: number | null;
  fmr_a: number | null;
  fmr_b: number | null;
  comp_score_a: number | null;
  created_at: string;
}

interface Prompt {
  id: string;
  pattern_type: string;
  query_text: string;
  model: string;
  run_number: number;
  response_text: string | null;
  recommendation: number | null;
  first_mention: string | null;
  key_arguments: string[] | null;
  status: string;
}

interface HistoricalAnalysis {
  id: string;
  brand_a: string;
  brand_b: string;
  driver: string;
  win_rate_a: number | null;
  win_rate_b: number | null;
  fmr_a: number | null;
  fmr_b: number | null;
  comp_score_a: number | null;
  status: string;
  created_at: string;
}

function compScoreLabel(score: number | null): { text: string; cls: string } {
  if (score == null) return { text: "\u2014", cls: "text-muted-foreground" };
  if (score >= 60) return { text: "compare.dominant", cls: "text-primary" };
  if (score >= 40) return { text: "compare.competitive", cls: "text-[#c4a882]" };
  return { text: "compare.disadvantaged", cls: "text-destructive" };
}

function recLabel(rec: number | string | null, brandA: string, brandB: string): { text: string; cls: string; isKey?: boolean } {
  const n = rec != null ? Number(rec) : null;
  if (n === 1) return { text: brandA, cls: "text-primary" };
  if (n === 2) return { text: brandB, cls: "text-destructive" };
  if (n === 0.5) return { text: "compare.draw", cls: "text-[#c4a882]", isKey: true };
  return { text: "compare.none", cls: "text-muted-foreground", isKey: true };
}

function fmLabel(fm: string | null, brandA: string, brandB: string): { text: string; isKey?: boolean } {
  if (fm === "A") return { text: brandA };
  if (fm === "B") return { text: brandB };
  return { text: "compare.draw", isKey: true };
}

/** Compute KPIs from a set of prompts */
function computeKpis(prompts: Prompt[]) {
  const completed = prompts.filter((p) => p.status === "completed");
  const total = completed.length;
  if (total === 0) return { winRateA: 0, winRateB: 0, fmrA: 0, fmrB: 0, compScoreA: 0 };

  const validRec = completed.filter((p) => p.recommendation != null && p.recommendation > 0);
  const validTotal = validRec.length || 1;

  const winsA = validRec.filter((p) => p.recommendation === 1).length;
  const winsB = validRec.filter((p) => p.recommendation === 2).length;

  const winRateA = Math.round((winsA / validTotal) * 1000) / 10;
  const winRateB = Math.round((winsB / validTotal) * 1000) / 10;

  const fmrA = Math.round((completed.filter((p) => p.first_mention === "A").length / total) * 1000) / 10;
  const fmrB = Math.round((completed.filter((p) => p.first_mention === "B").length / total) * 1000) / 10;

  const compScoreA = Math.round((0.6 * winRateA + 0.4 * fmrA) * 10) / 10;

  return { winRateA, winRateB, fmrA, fmrB, compScoreA };
}

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
};

export function CompetitiveResults({
  analysis,
  prompts,
  historicalAnalyses,
  currentAnalysisId,
}: {
  analysis: Analysis;
  prompts: Prompt[];
  historicalAnalyses?: HistoricalAnalysis[];
  currentAnalysisId?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const a = analysis;
  const isRunning = a.status === "running" || a.status === "pending";

  // Model filter state
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<Prompt | null>(null);

  const models = useMemo(() => {
    const unique = Array.from(new Set(prompts.map((p) => p.model)));
    unique.sort();
    return unique;
  }, [prompts]);

  // Filtered prompts and KPIs
  const { filteredPrompts, kpis } = useMemo(() => {
    const fp = selectedModel ? prompts.filter((p) => p.model === selectedModel) : prompts;
    const k = selectedModel ? computeKpis(fp) : {
      winRateA: a.win_rate_a ?? 0,
      winRateB: a.win_rate_b ?? 0,
      fmrA: a.fmr_a ?? 0,
      fmrB: a.fmr_b ?? 0,
      compScoreA: a.comp_score_a ?? 0,
    };
    return { filteredPrompts: fp, kpis: k };
  }, [selectedModel, prompts, a]);

  const label = compScoreLabel(kpis.compScoreA);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [isRunning, router]);

  const argCounts = new Map<string, number>();
  for (const p of filteredPrompts) {
    for (const arg of p.key_arguments ?? []) {
      const key = arg.toLowerCase().trim();
      argCounts.set(key, (argCounts.get(key) ?? 0) + 1);
    }
  }
  const topArgs = Array.from(argCounts.entries())
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8);

  // Build trend chart data
  const history = (historicalAnalyses ?? []).filter((h) => h.status === "completed");
  const showTrend = history.length >= 2;

  const trendData = history.map((h) => ({
    date: new Date(h.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    winRateA: h.win_rate_a ?? 0,
    winRateB: h.win_rate_b ?? 0,
    compScoreA: h.comp_score_a ?? 0,
    id: h.id,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href="/compare"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("nav.backToComparison")}
        </a>
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              {a.brand_a} vs {a.brand_b}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Driver: {a.driver} &middot; {new Date(a.created_at).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="card p-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            {t("runDetail.analysisInProgress")} {prompts.filter((p) => p.status === "completed").length}/{prompts.length} {t("compare.responses")}
          </p>
        </div>
      )}

      {a.status === "completed" && (
        <>
          {/* Model filter chips */}
          {models.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setSelectedModel(null)}
                className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
                style={
                  selectedModel === null
                    ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                    : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
                }
              >
                {t("common.all")}
              </button>
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
                  style={
                    selectedModel === model
                      ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                      : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
                  }
                >
                  {getModelDisplayName(model)}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Win Rate */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Win Rate</h3>
                <InfoTooltip text={t("compare.winRateTooltip")} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_a}</span>
                  <span className="text-sm font-bold text-primary">{kpis.winRateA}%</span>
                </div>
                <div className="h-2 bg-muted rounded-[2px] overflow-hidden flex">
                  <div
                    className="h-full rounded-l-[2px] transition-all duration-700"
                    style={{ width: `${kpis.winRateA}%`, background: "#7eb89a" }}
                  />
                  <div
                    className="h-full rounded-r-[2px] transition-all duration-700"
                    style={{ width: `${kpis.winRateB}%`, background: "rgba(192,97,74,0.6)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_b}</span>
                  <span className="text-sm font-bold text-destructive">{kpis.winRateB}%</span>
                </div>
              </div>
            </div>

            {/* First Mention Rate */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Mention</h3>
                <InfoTooltip text={t("compare.firstMentionTooltip")} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_a}</span>
                  <span className="text-sm font-bold text-primary">{kpis.fmrA}%</span>
                </div>
                <div className="h-2 bg-muted rounded-[2px] overflow-hidden flex">
                  <div
                    className="h-full rounded-l-[2px] transition-all duration-700"
                    style={{ width: `${kpis.fmrA}%`, background: "#7eb89a" }}
                  />
                  <div
                    className="h-full rounded-r-[2px] transition-all duration-700"
                    style={{ width: `${kpis.fmrB}%`, background: "rgba(192,97,74,0.6)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_b}</span>
                  <span className="text-sm font-bold text-destructive">{kpis.fmrB}%</span>
                </div>
              </div>
            </div>

            {/* CompScore */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">CompScore</h3>
                <InfoTooltip text="CompScore = 60% Win Rate + 40% First Mention Rate. Misura la forza competitiva del brand nelle risposte AI. Scala 0-100." />
              </div>
              <div className="flex flex-col items-center pt-1">
                <CompScoreRing score={kpis.compScoreA} />
                <p className={`text-sm font-medium mt-2 ${label.cls}`}>{label.text === "\u2014" ? label.text : t(label.text)}</p>
              </div>
            </div>
          </div>

          {topArgs.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t("compare.mainArguments")}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {topArgs.map(([arg, count]) => (
                  <span
                    key={arg}
                    className="px-3 py-1.5 rounded-[2px] text-sm bg-muted/50 border border-border text-foreground"
                  >
                    {arg}
                    <span className="ml-1.5 text-xs text-muted-foreground">&times;{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("compare.responseDetail")} ({filteredPrompts.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.pattern")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.model")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.run")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.preview")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.preference")}</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.firstMention")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrompts.map((p) => {
                    const rec = recLabel(p.recommendation, a.brand_a, a.brand_b);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => p.response_text && setExpandedPrompt(p)}
                      >
                        <td className="px-4 py-2.5">
                          <span className="badge badge-primary text-[12px]">{p.pattern_type}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{getModelDisplayName(p.model)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">#{p.run_number}</td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <p className="text-foreground truncate text-xs">
                            {p.response_text?.substring(0, 120) ?? "\u2014"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold ${rec.cls}`}>{rec.isKey ? t(rec.text) : rec.text}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {(() => { const fm = fmLabel(p.first_mention, a.brand_a, a.brand_b); return fm.isKey ? t(fm.text) : fm.text; })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend section */}
          {showTrend && (
            <>
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-semibold text-foreground">{t("compare.trendOverTime")}</h3>
                  <span className="badge badge-muted text-[12px]">{history.length} {t("compare.analysesCount")}</span>
                </div>

                <div className="flex items-center gap-4 font-mono text-[12px] text-cream-dim">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: "#7eb89a" }} />
                    Win Rate {a.brand_a}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: "#c0614a" }} />
                    Win Rate {a.brand_b}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: "#7eb89a", opacity: 0.5 }} />
                    CompScore {a.brand_a}
                  </span>
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="winRateA" name={`Win Rate ${a.brand_a}`} stroke="#7eb89a" strokeWidth={2} dot={{ r: 4, fill: "#7eb89a" }} connectNulls />
                    <Line type="monotone" dataKey="winRateB" name={`Win Rate ${a.brand_b}`} stroke="#c0614a" strokeWidth={2} dot={{ r: 4, fill: "#c0614a" }} connectNulls />
                    <Line type="monotone" dataKey="compScoreA" name={`CompScore ${a.brand_a}`} stroke="#7eb89a" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: "#7eb89a" }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Historical analyses table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("compare.historicalAnalyses")} ({history.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.dateCol")}</th>
                        <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Win Rate {a.brand_a}</th>
                        <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Win Rate {a.brand_b}</th>
                        <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">FMR {a.brand_a}</th>
                        <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">CompScore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => {
                        const isCurrent = h.id === currentAnalysisId;
                        const hLabel = compScoreLabel(h.comp_score_a);
                        return (
                          <tr
                            key={h.id}
                            className={`border-b border-border/50 transition-colors ${isCurrent ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"}`}
                          >
                            <td className="px-4 py-2.5">
                              <a
                                href={`/compare/${h.id}`}
                                className={`hover:text-primary transition-colors ${isCurrent ? "text-primary font-medium" : "text-foreground"}`}
                              >
                                {new Date(h.created_at).toLocaleDateString("it-IT")}
                                {isCurrent && <span className="ml-2 text-[12px] text-primary opacity-70">{t("compare.current")}</span>}
                              </a>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-primary">{h.win_rate_a ?? 0}%</td>
                            <td className="px-4 py-2.5 font-bold text-destructive">{h.win_rate_b ?? 0}%</td>
                            <td className="px-4 py-2.5 text-foreground">{h.fmr_a ?? 0}%</td>
                            <td className="px-4 py-2.5">
                              <span className={`font-bold ${hLabel.cls}`}>
                                {h.comp_score_a != null ? Math.round(h.comp_score_a) : "\u2014"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Response detail modal */}
      {expandedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setExpandedPrompt(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg shadow-2xl p-6 space-y-4"
            style={{ background: "#111416", border: "1px solid rgba(126,184,154,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{t("compare.responseDetail")}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{expandedPrompt.query_text}</p>
              </div>
              <button onClick={() => setExpandedPrompt(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <span className="badge badge-primary">{expandedPrompt.pattern_type}</span>
              <span className="badge badge-muted">{getModelDisplayName(expandedPrompt.model)}</span>
              <span className="badge badge-muted">Run #{expandedPrompt.run_number}</span>
              {expandedPrompt.recommendation != null && (() => {
                const rec = recLabel(expandedPrompt.recommendation, a.brand_a, a.brand_b);
                return <span className={`badge badge-muted ${rec.cls}`}>{rec.isKey ? t(rec.text) : rec.text}</span>;
              })()}
            </div>

            {expandedPrompt.key_arguments && expandedPrompt.key_arguments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {expandedPrompt.key_arguments.map((arg, i) => (
                  <span key={i} className="text-xs bg-muted border border-border rounded-[2px] px-2 py-0.5 text-foreground">{arg}</span>
                ))}
              </div>
            )}

            <div className="bg-muted/10 rounded-[2px] px-4 py-3 border border-border max-h-[50vh] overflow-y-auto">
              <MarkdownResponse text={expandedPrompt.response_text || ""} />
            </div>
          </div>
        </div>
      )}

      {a.status === "failed" && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-destructive font-medium">{t("compare.analysisFailed")}</p>
          <p className="text-sm text-muted-foreground">{t("compare.errorOccurred")}</p>
        </div>
      )}
    </div>
  );
}

/** Small score ring matching AVIRing design system */
function CompScoreRing({ score }: { score: number }) {
  const R = 40, C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, score));
  const dash = (v / 100) * C;

  // Color: green (>60), amber (40-60), coral (<40) — matches AVIRing palette
  function scoreColor(s: number): string {
    if (s >= 60) return "hsl(150, 40%, 55%)"; // sage green
    if (s >= 40) return "hsl(35, 40%, 55%)";  // amber
    return "hsl(15, 40%, 55%)";               // coral
  }
  const color = scoreColor(v);

  return (
    <div className="relative w-[100px] h-[100px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="48" cy="48" r={R} fill="none"
          stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - dash}
          style={{ transition: "stroke-dashoffset 1.2s ease-out, stroke 0.8s ease-out",
                   filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] leading-none text-foreground" style={{ fontWeight: 300 }}>
          {Math.round(v)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

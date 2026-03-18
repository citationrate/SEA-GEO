"use client";

import { useState, useMemo, Fragment } from "react";
import { Globe, Tag, Users, ExternalLink, Eye, Hash, TrendingUp, TrendingDown, AlertTriangle, X, ChevronDown, ChevronRight } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

interface RunMetricsProps {
  prompts: any[];
  analyses: any[];
  sources: any[];
  models: string[];
  competitorMentions: any[];
  brandAviScore: number;
  targetBrand: string;
  queries?: any[];
  competitorAviData?: any[];
  externalSelectedModel?: string | null;
}

function sentimentSign(v: number): string {
  return v > 0.1 ? "+" : "";
}

function sentimentColor(v: number): string {
  if (v > 0.1) return "text-success";
  if (v < -0.1) return "text-destructive";
  return "text-muted-foreground";
}

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

function classifyError(error: string | null): string {
  if (!error) return "";
  const lower = error.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate")) return "runMetrics.quotaExhausted";
  if (lower.includes("timeout")) return "Timeout";
  return "runMetrics.apiError";
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  brand_owned: "border-primary/30 bg-primary/5 text-primary",
  review: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
  social: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  news: "border-gray-400/30 bg-gray-400/5 text-gray-400",
  ecommerce: "border-orange-500/30 bg-orange-500/5 text-orange-400",
  wikipedia: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  brand_owned: "Brand",
  review: "Review",
  social: "Social",
  news: "News",
  ecommerce: "E-commerce",
  wikipedia: "Wikipedia",
  other: "Altro",
};

export function RunMetrics({ prompts, analyses, sources, models, competitorMentions, brandAviScore, targetBrand, queries, competitorAviData, externalSelectedModel }: RunMetricsProps) {
  const { t } = useTranslation();
  const hasExternalModel = externalSelectedModel !== undefined;
  const [internalModel, setInternalModel] = useState<string | null>(null);
  const selectedModel = hasExternalModel ? externalSelectedModel : internalModel;
  const setSelectedModel = setInternalModel;
  const [funnelFilter, setFunnelFilter] = useState<string | null>(null);

  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [modalPrompt, setModalPrompt] = useState<any | null>(null);
  const [topicsExpanded, setTopicsExpanded] = useState(false);

  // Build query map for funnel stage lookup
  const queryMap = useMemo(() => {
    const map = new Map<string, any>();
    (queries ?? []).forEach((q: any) => map.set(q.id, q));
    return map;
  }, [queries]);

  const filtered = useMemo(() => {
    let filteredPrompts = selectedModel
      ? prompts.filter((p) => p.model === selectedModel)
      : [...prompts];

    // Apply funnel stage filter
    if (funnelFilter && queryMap.size > 0) {
      filteredPrompts = filteredPrompts.filter((p) => {
        const q = queryMap.get(p.query_id);
        return q?.funnel_stage?.toLowerCase() === funnelFilter.toLowerCase();
      });
    }

    const filteredPromptIds = new Set(filteredPrompts.map((p) => p.id));

    const filteredAnalyses = analyses.filter((a) => filteredPromptIds.has(a.prompt_executed_id));
    const filteredSources = sources.filter((s) => filteredPromptIds.has(s.prompt_executed_id));

    const analysisMap = new Map(filteredAnalyses.map((a) => [a.prompt_executed_id, a]));

    const totalAnalysed = filteredAnalyses.length;
    const mentionCount = filteredAnalyses.filter((a) => a.brand_mentioned).length;
    const mentionRate = totalAnalysed > 0 ? Math.round((mentionCount / totalAnalysed) * 100) : 0;

    const ranked = filteredAnalyses.filter((a) => a.brand_rank !== null && a.brand_rank > 0);
    const avgRank = ranked.length > 0
      ? (ranked.reduce((s: number, a: any) => s + a.brand_rank, 0) / ranked.length).toFixed(1)
      : "\u2014";

    const withSentiment = filteredAnalyses.filter((a) => a.sentiment_score !== null);
    const avgSentimentNum = withSentiment.length > 0
      ? withSentiment.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSentiment.length
      : null;
    const avgSentiment = avgSentimentNum != null
      ? `${sentimentSign(avgSentimentNum)}${avgSentimentNum.toFixed(2)}`
      : "\u2014";
    const avgSentimentColor = avgSentimentNum != null ? sentimentColor(avgSentimentNum) : "text-foreground";

    const withTone = filteredAnalyses.filter((a) => a.tone_score != null);
    const avgTone = withTone.length > 0
      ? withTone.reduce((s: number, a: any) => s + a.tone_score, 0) / withTone.length
      : null;

    const withPosition = filteredAnalyses.filter((a) => a.position_score != null);
    const avgPosition = withPosition.length > 0
      ? withPosition.reduce((s: number, a: any) => s + a.position_score, 0) / withPosition.length
      : null;

    const withRec = filteredAnalyses.filter((a) => a.recommendation_score != null);
    const avgRec = withRec.length > 0
      ? withRec.reduce((s: number, a: any) => s + a.recommendation_score, 0) / withRec.length
      : null;

    const totalOccurrences = filteredAnalyses.reduce((s: number, a: any) => s + (a.brand_occurrences ?? 0), 0);

    const competitorsMap = new Map<string, number>();
    filteredAnalyses.forEach((a) => {
      (a.competitors_found ?? []).forEach((c: string) => {
        competitorsMap.set(c, (competitorsMap.get(c) ?? 0) + 1);
      });
    });

    // Use pre-computed competitor AVI from DB (case-insensitive keys)
    const computedCompAviMap: Record<string, number> = {};
    console.log("[DEBUG RunMetrics] competitorAviData received:", competitorAviData?.length ?? "null/undefined", JSON.stringify((competitorAviData ?? []).slice(0, 2)));
    console.log("[DEBUG RunMetrics] competitors_found sample:", Array.from(competitorsMap.keys()).slice(0, 5));
    (competitorAviData ?? []).forEach((c: any) => {
      computedCompAviMap[c.competitor_name] = c.avi_score;
      computedCompAviMap[c.competitor_name.toLowerCase().trim()] = c.avi_score;
    });
    console.log("[DEBUG RunMetrics] computedCompAviMap keys:", Object.keys(computedCompAviMap).slice(0, 10));

    const competitorList = Array.from(competitorsMap.entries()).sort((a, b) => {
      const aviA = computedCompAviMap[a[0]] ?? computedCompAviMap[a[0].toLowerCase().trim()] ?? 0;
      const aviB = computedCompAviMap[b[0]] ?? computedCompAviMap[b[0].toLowerCase().trim()] ?? 0;
      return aviB - aviA || b[1] - a[1];
    });

    const topicsMap = new Map<string, number>();
    filteredAnalyses.forEach((a) => {
      (a.topics ?? []).forEach((t: string) => {
        topicsMap.set(t, (topicsMap.get(t) ?? 0) + 1);
      });
    });
    const topicList = Array.from(topicsMap.entries()).sort((a, b) => b[1] - a[1]);

    // Group sources by type with counts
    const sourcesByType = new Map<string, any[]>();
    filteredSources.forEach((s: any) => {
      const type = s.source_type || "other";
      if (!sourcesByType.has(type)) sourcesByType.set(type, []);
      sourcesByType.get(type)!.push(s);
    });

    return {
      filteredPrompts,
      filteredSources,
      analysisMap,
      totalAnalysed,
      mentionCount,
      mentionRate,
      ranked,
      avgRank,
      avgSentiment,
      avgSentimentColor,
      avgTone,
      avgPosition,
      avgRec,
      totalOccurrences,
      computedCompAviMap,
      competitorList,
      topicList,
      sourcesByType,
    };
  }, [selectedModel, funnelFilter, prompts, analyses, sources, competitorMentions, queryMap, competitorAviData]);

  const {
    filteredPrompts,
    filteredSources,
    analysisMap,
    totalAnalysed,
    mentionCount,
    mentionRate,
    ranked,
    avgRank,
    avgSentiment,
    avgSentimentColor,
    avgTone,
    avgPosition,
    avgRec,
    totalOccurrences,
    computedCompAviMap,
    competitorList,
    topicList,
    sourcesByType,
  } = filtered;

  // Check if we have funnel stages available
  const hasFunnelData = queryMap.size > 0;
  const funnelStages = useMemo(() => {
    if (!hasFunnelData) return [];
    const stages = new Set<string>();
    prompts.forEach((p) => {
      const q = queryMap.get(p.query_id);
      if (q?.funnel_stage) stages.add(q.funnel_stage.toUpperCase());
    });
    return Array.from(stages).sort();
  }, [hasFunnelData, prompts, queryMap]);

  return (
    <>
      {/* Filter pills row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Model filter — only shown when NOT controlled externally */}
        {!hasExternalModel && models.length > 1 && (
          <>
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
                  {MODEL_LABELS[model] ?? model}
                </button>
              ))}
          </>
        )}

        {/* Separator */}
        {!hasExternalModel && models.length > 1 && funnelStages.length > 0 && (
          <div className="w-px h-5 bg-border mx-1" />
        )}

        {/* Funnel stage filter */}
        {funnelStages.length > 0 && (
          <>
            <button
              onClick={() => setFunnelFilter(null)}
              className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
              style={
                funnelFilter === null
                  ? { borderColor: "#e8956d", backgroundColor: "rgba(232,149,109,0.1)", color: "#e8956d" }
                  : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
              }
            >
              {t("common.all")}
            </button>
            {funnelStages.map((stage) => (
              <button
                key={stage}
                onClick={() => setFunnelFilter(stage)}
                className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
                style={
                  funnelFilter === stage
                    ? { borderColor: "#e8956d", backgroundColor: "rgba(232,149,109,0.1)", color: "#e8956d" }
                    : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
                }
              >
                {stage}
              </button>
            ))}
          </>
        )}

      </div>

      {/* Brand Mention Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        <div className="card p-4 text-center">
          <Eye className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{mentionRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">{t("runMetrics.brandMentions")} <InfoTooltip text={t("runMetrics.brandMentionTooltip")} /></p>
          <p className="text-[12px] text-muted-foreground">{mentionCount}/{totalAnalysed} prompt</p>
        </div>
        <div className="card p-4 text-center">
          <Hash className="w-5 h-5 text-accent mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{totalOccurrences}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("runMetrics.totalOccurrences")}</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{avgRank}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">{t("runMetrics.avgRank")} <InfoTooltip text={t("runMetrics.avgRankTooltip")} /></p>
          <p className="text-[12px] text-muted-foreground">{ranked.length} {t("runMetrics.responsesWithRank")}</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingDown className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className={`font-display font-bold text-2xl ${avgSentimentColor}`}>{avgSentiment}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">{t("runMetrics.avgSentiment")} <InfoTooltip text={t("runMetrics.avgSentimentTooltip")} /></p>
          <p className="text-[12px] text-muted-foreground">{t("runMetrics.scale")} -1 / +1</p>
          {avgTone !== null && avgPosition !== null && avgRec !== null && (
            <div className="space-y-1 mt-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.625rem] text-muted-foreground w-16">TONE</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px]"
                       style={{
                         width: `${Math.abs(avgTone) * 100}%`,
                         backgroundColor: avgTone >= 0 ? '#7eb89a' : '#c0614a',
                         marginLeft: avgTone < 0 ? `${(1 + avgTone) * 100}%` : '0'
                       }}
                  />
                </div>
                <span className={`font-mono text-[0.625rem] w-8 text-right ${sentimentColor(avgTone)}`}>
                  {sentimentSign(avgTone)}{avgTone.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.625rem] text-muted-foreground w-16">POSITION</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px] bg-[#7eb3d4]"
                       style={{ width: `${avgPosition * 100}%` }} />
                </div>
                <span className="font-mono text-[0.625rem] text-muted-foreground w-8 text-right">
                  {avgPosition.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.625rem] text-muted-foreground w-16">REC</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px]"
                       style={{
                         width: `${Math.abs(avgRec) * 100}%`,
                         backgroundColor: avgRec >= 0 ? '#c4a882' : '#c0614a'
                       }} />
                </div>
                <span className={`font-mono text-[0.625rem] w-8 text-right ${sentimentColor(avgRec)}`}>
                  {sentimentSign(avgRec)}{avgRec.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Benchmark vs Competitors */}
      {(() => {
        console.log("[BENCHMARK] competitorAviData:", competitorAviData);
        console.log("[BENCHMARK] competitorList (from response_analysis):", competitorList.map(([n, c]) => `${n}(${c})`));
        console.log("[BENCHMARK] computedCompAviMap:", computedCompAviMap);
        console.log("[BENCHMARK] name match test:", competitorList.map(([name]) => ({
          name,
          exactMatch: computedCompAviMap[name],
          lowerMatch: computedCompAviMap[name.toLowerCase().trim()],
          found: (competitorAviData ?? []).find((r: any) => r.competitor_name === name),
        })));
        return null;
      })()}
      {competitorList.length > 0 && (() => {
        const effectiveBrandScore = brandAviScore;
        const top5 = competitorList.slice(0, 5).map(([name]) => ({
          name,
          avi: computedCompAviMap[name] ?? computedCompAviMap[name.toLowerCase().trim()] ?? 0,
        }));
        return (
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground text-sm">{t("runMetrics.benchmark")}</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary w-32 truncate">{targetBrand || "Il tuo brand"}</span>
                <div className="flex-1 h-2.5 bg-muted rounded-[2px] overflow-hidden">
                  <div
                    className="h-full rounded-[2px] transition-all duration-700"
                    style={{ width: `${effectiveBrandScore}%`, background: "#7eb89a" }}
                  />
                </div>
                <span className="text-xs font-bold text-primary w-14 text-right">AVI {Math.round(effectiveBrandScore * 10) / 10}</span>
              </div>
              {top5.map((c) => {
                const beats = c.avi > effectiveBrandScore;
                const barBg = c.avi >= 70 ? "rgba(126,184,154,0.5)" : c.avi >= 40 ? "rgba(232,226,214,0.3)" : "rgba(192,97,74,0.3)";
                const textColor = beats ? "text-destructive" : c.avi >= 70 ? "text-primary" : c.avi >= 40 ? "text-cream" : "text-destructive";
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground w-32 truncate">{c.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-[2px] overflow-hidden">
                      <div
                        className="h-full rounded-[2px] transition-all duration-700"
                        style={{ width: `${c.avi}%`, background: barBg }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-14 text-right ${c.avi > 0 ? textColor : "text-muted-foreground"}`}>
                      {c.avi > 0 ? `AVI ${Math.round(c.avi * 10) / 10}` : "\u2014"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Competitors & Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("runMetrics.competitorsFound")}</h2>
            <span className="badge badge-muted text-[12px]">{competitorList.length}</span>
          </div>
          {competitorList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("runMetrics.noCompetitor")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {competitorList.map(([name, count]) => {
                const cAvi = computedCompAviMap[name] ?? computedCompAviMap[name.toLowerCase().trim()];
                const aviColor = cAvi != null
                  ? cAvi >= 70 ? "text-success" : cAvi >= 40 ? "text-amber-500" : "text-destructive"
                  : "";
                return (
                  <span key={name} className="badge badge-primary flex items-center gap-1.5">
                    {name}
                    <span className="text-[11px] opacity-70">({count})</span>
                    {cAvi != null && (
                      <span className={`text-[12px] font-bold ${aviColor}`}>AVI {cAvi}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-accent" />
            <h2 className="font-display font-semibold text-foreground">{t("runMetrics.topicsFound")}</h2>
            <span className="badge badge-muted text-[12px]">{topicList.length}</span>
          </div>
          {topicList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("runMetrics.noTopic")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(topicsExpanded ? topicList : topicList.slice(0, 8)).map(([name, count]) => {
                  const size = count >= 5 ? "text-sm" : count >= 3 ? "text-xs" : "text-[12px]";
                  const opacity = count >= 5 ? "opacity-100" : count >= 3 ? "opacity-80" : "opacity-60";
                  return (
                    <span key={name} className={`badge badge-muted ${size} ${opacity} whitespace-normal break-words max-w-full`} title={name}>
                      {name}
                    </span>
                  );
                })}
              </div>
              {topicList.length > 8 && (
                <button
                  onClick={() => setTopicsExpanded(!topicsExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {topicsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {topicsExpanded ? t("common.showLess") : `${t("common.showAll")} (${topicList.length})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sources grouped by type */}
      {filteredSources.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("runMetrics.sourcesConsulted")}</h2>
            <span className="badge badge-muted text-[12px]">{filteredSources.length}</span>
          </div>

          {/* Source type counts */}
          <div className="flex flex-wrap gap-2">
            {Array.from(sourcesByType.entries()).map(([type, items]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded-[2px] border ${SOURCE_TYPE_COLORS[type] ?? "border-border bg-muted/30 text-foreground"}`}
              >
                {type === "other" ? t("runMetrics.other") : (SOURCE_TYPE_LABELS[type] ?? type)}
                <span className="opacity-70">{items.length}</span>
              </span>
            ))}
          </div>

          {/* Source chips grouped */}
          {Array.from(sourcesByType.entries()).map(([type, items]) => (
            <div key={type} className="space-y-1.5">
              <p className="font-mono text-[0.75rem] uppercase tracking-wide text-muted-foreground">{type === "other" ? t("runMetrics.other") : (SOURCE_TYPE_LABELS[type] ?? type)}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((s: any) => {
                  const label = s.label || s.domain || "\u2014";
                  const url = s.url || (s.domain ? `https://${s.domain}` : "#");
                  return (
                    <a
                      key={s.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[2px] border transition-colors hover:opacity-80 ${SOURCE_TYPE_COLORS[type] ?? "border-border bg-muted/30 text-foreground"}`}
                      title={s.url || s.domain}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prompt results table */}
      {filteredPrompts.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-display font-semibold text-foreground">{t("runMetrics.promptsExecuted")} ({filteredPrompts.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Query</th>
                  {hasFunnelData && <th className="text-left py-2 pr-3 font-medium">Tipo</th>}
                  <th className="text-left py-2 pr-3 font-medium">Modello</th>
                  <th className="text-left py-2 pr-3 font-medium">Run</th>
                  <th className="text-left py-2 pr-3 font-medium">Brand</th>
                  <th className="text-left py-2 pr-3 font-medium">Rank</th>
                  <th className="text-left py-2 pr-3 font-medium">Sentiment</th>
                  <th className="text-left py-2 pr-3 font-medium">Competitors</th>
                  <th className="text-left py-2 pr-3 font-medium">Stato</th>
                  <th className="text-left py-2 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map((p: any, i: number) => {
                  const analysis = analysisMap.get(p.id) as any;
                  const isError = !!p.error;
                  const errorLabel = classifyError(p.error);
                  const query = queryMap.get(p.query_id);
                  const queryText = query?.text || p.prompt_text || "";
                  const funnelStage = query?.funnel_stage?.toUpperCase() || "";
                  return (
                    <Fragment key={p.id}>
                      <tr className={`border-b border-border/50 ${isError ? "bg-destructive/5 border-l-2 border-l-destructive" : "hover:bg-muted/30"}`}>
                        <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 text-foreground text-xs max-w-[200px] truncate" title={queryText}>
                          {queryText.slice(0, 60)}{queryText.length > 60 ? "..." : ""}
                        </td>
                        {hasFunnelData && (
                          <td className="py-2 pr-3">
                            {funnelStage && (
                              <span className="badge badge-muted text-[12px]">{funnelStage}</span>
                            )}
                          </td>
                        )}
                        <td className="py-2 pr-3"><span className="badge badge-muted text-[12px]">{p.model}</span></td>
                        <td className="py-2 pr-3 text-muted-foreground">{p.run_number}</td>
                        <td className="py-2 pr-3">
                          {analysis ? (
                            analysis.brand_mentioned
                              ? <span className="text-success font-medium">Si</span>
                              : <span className="text-muted-foreground">No</span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2 pr-3 text-foreground">{analysis?.brand_rank ?? "-"}</td>
                        <td className="py-2 pr-3">
                          {analysis?.sentiment_score != null ? (
                            <span className={sentimentColor(analysis.sentiment_score)}>
                              {sentimentSign(analysis.sentiment_score)}{analysis.sentiment_score.toFixed(2)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {analysis?.competitors_found?.length ? analysis.competitors_found.join(", ") : "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {isError
                            ? <span className="badge badge-muted text-destructive text-[12px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {errorLabel ? t(errorLabel) : t("common.error")}
                              </span>
                            : p.raw_response
                              ? <span className="badge badge-success text-[12px]">OK</span>
                              : <span className="badge badge-muted text-[12px]">Pending</span>}
                        </td>
                        <td className="py-2">
                          {p.raw_response && (
                            <button
                              onClick={() => setModalPrompt({ prompt: p, analysis, query })}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Espandi risposta"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {isError && (
                        <tr className="bg-destructive/5">
                          <td colSpan={hasFunnelData ? 11 : 10} className="py-1.5 px-3 text-xs text-destructive/80 font-mono truncate">
                            {p.error}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Response detail modal */}
      {modalPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalPrompt(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg shadow-2xl p-6 space-y-4"
            style={{ background: "#111416", border: "1px solid rgba(126,184,154,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display font-bold text-lg text-foreground">{t("runMetrics.responseDetail")}</h3>
              <button onClick={() => setModalPrompt(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Query */}
            <div className="space-y-1">
              <p className="font-mono text-[0.75rem] uppercase tracking-wide text-muted-foreground">Query</p>
              <p className="text-sm text-foreground bg-muted/20 rounded-[2px] px-3 py-2">
                {modalPrompt.query?.text || modalPrompt.prompt.prompt_text || "N/A"}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="badge badge-muted">{modalPrompt.prompt.model}</span>
              {modalPrompt.query?.funnel_stage && (
                <span className="badge badge-primary">{modalPrompt.query.funnel_stage.toUpperCase()}</span>
              )}
              {modalPrompt.analysis?.brand_mentioned != null && (
                <span className={`badge ${modalPrompt.analysis.brand_mentioned ? "badge-success" : "badge-muted"}`}>
                  Brand: {modalPrompt.analysis.brand_mentioned ? "Si" : "No"}
                </span>
              )}
              {modalPrompt.analysis?.brand_rank != null && (
                <span className="badge badge-muted">Rank: {modalPrompt.analysis.brand_rank}</span>
              )}
              {modalPrompt.analysis?.sentiment_score != null && (
                <span className={`badge badge-muted ${sentimentColor(modalPrompt.analysis.sentiment_score)}`}>
                  Sentiment: {sentimentSign(modalPrompt.analysis.sentiment_score)}{modalPrompt.analysis.sentiment_score.toFixed(2)}
                </span>
              )}
            </div>

            {/* Response note */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-[2px] border border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">
                La risposta completa è consultabile nella sezione <a href="/datasets" className="text-primary hover:text-primary/70 transition-colors font-medium">Dataset</a>.
              </p>
            </div>

            {/* Sources found */}
            {(() => {
              const promptSources = sources.filter((s: any) => s.prompt_executed_id === modalPrompt.prompt.id);
              if (promptSources.length === 0) return null;
              return (
                <div className="space-y-1">
                  <p className="font-mono text-[0.75rem] uppercase tracking-wide text-muted-foreground">Fonti ({promptSources.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {promptSources.map((s: any) => (
                      <a
                        key={s.id}
                        href={s.url || (s.domain ? `https://${s.domain}` : "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {s.label || s.domain || s.url}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Competitors found */}
            {modalPrompt.analysis?.competitors_found?.length > 0 && (
              <div className="space-y-1">
                <p className="font-mono text-[0.75rem] uppercase tracking-wide text-muted-foreground">{t("runMetrics.competitorsFound")}</p>
                <div className="flex flex-wrap gap-2">
                  {modalPrompt.analysis.competitors_found.map((c: string) => (
                    <span key={c} className="badge badge-primary text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

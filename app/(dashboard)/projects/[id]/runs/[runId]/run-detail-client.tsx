"use client";

import { useState, useMemo } from "react";
import { MessageSquareText } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useConsultation } from "@/lib/consultation-context";
import { RunAVIRing } from "./run-avi-ring";
import { AVIBars } from "./avi-bars";
import { RunMetrics } from "./run-metrics";
import { SegmentSection } from "./segment-section";
import { StabilitySection } from "./stability-section";

const MODEL_LABELS: Record<string, string> = {
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "gpt-5.4": "GPT-5.4",
  "o1-mini": "o1 Mini",
  "o3-mini": "o3 Mini",
  "o3": "o3",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "perplexity-sonar": "Perplexity Sonar",
  "perplexity-sonar-pro": "Perplexity Sonar Pro",
  "claude-haiku": "Claude Haiku 4.5",
  "claude-sonnet": "Claude Sonnet 4.6",
  "claude-opus": "Claude Opus 4.6",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
  "copilot-gpt4": "Copilot GPT-4",
};

const AVI_MAIN_COMPONENTS = [
  { key: "presence_score",  labelKey: "dashboard.presence",  color: "#e8956d", descKey: "dashboard.presenceTooltip" },
  { key: "rank_score",      labelKey: "dashboard.position",  color: "#7eb3d4", descKey: "dashboard.positionTooltip" },
  { key: "sentiment_score", labelKey: "dashboard.sentiment",  color: "#7eb89a", descKey: "dashboard.sentimentTooltip" },
];

/* ─── Client-side AVI calculation (mirrors lib/engine/avi.ts) ─── */
interface AVICalcResult {
  avi_score: number;
  presence_score: number;
  rank_score: number;
  sentiment_score: number;
  stability_score: number;
}

function calculateAVIFromAnalyses(analyses: any[], prompts: any[]): AVICalcResult {
  const zero: AVICalcResult = { avi_score: 0, presence_score: 0, rank_score: 0, sentiment_score: 0, stability_score: 0 };
  if (analyses.length === 0) return zero;

  const mentionValues: number[] = analyses.map((a) => (a.brand_mentioned ? 1 : 0));
  const mean = mentionValues.reduce((s, v) => s + v, 0) / mentionValues.length;
  const variance = mentionValues.reduce((s, v) => s + (v - mean) ** 2, 0) / mentionValues.length;
  const stability_score = (1 - Math.sqrt(variance)) * 100;

  const mentionedCount = analyses.filter((a) => a.brand_mentioned).length;
  if (mentionedCount === 0) {
    return { ...zero, stability_score: Math.round(stability_score * 100) / 100 };
  }

  const presence_score = (mentionedCount / analyses.length) * 100;

  const rankValues = analyses.map((a) => {
    if (!a.brand_mentioned || a.brand_rank === null || a.brand_rank <= 0) return 0;
    return Math.max(0, 100 - (a.brand_rank - 1) * 20);
  });
  const rank_score = rankValues.reduce((s, v) => s + v, 0) / rankValues.length;

  const sentimentValues = analyses.map((a) => {
    if (!a.brand_mentioned || a.sentiment_score === null) return 0;
    return (a.sentiment_score + 1) * 50;
  });
  const sentiment_score = sentimentValues.reduce((s, v) => s + v, 0) / sentimentValues.length;

  const avi_score = Math.round(
    (presence_score * 0.40 + rank_score * 0.35 + sentiment_score * 0.25) * 10
  ) / 10;

  return {
    avi_score: Math.max(0, Math.min(100, avi_score)),
    presence_score: Math.round(presence_score * 100) / 100,
    rank_score: Math.round(rank_score * 100) / 100,
    sentiment_score: Math.round(sentiment_score * 100) / 100,
    stability_score: Math.round(stability_score * 100) / 100,
  };
}

export interface RunDetailClientProps {
  aviData: any;
  trend: number | null;
  totalActiveRuns: number;
  prompts: any[];
  analyses: any[];
  sources: any[];
  models: string[];
  competitorMentions: any[];
  targetBrand: string;
  queries: any[];
  competitorAviData: any[];
  segments: any[];
  runCount: number;
}

export function RunDetailClient({
  aviData,
  trend,
  totalActiveRuns,
  prompts,
  analyses,
  sources,
  models,
  competitorMentions,
  targetBrand,
  queries,
  competitorAviData,
  segments,
  runCount,
}: RunDetailClientProps) {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Build analysis map by prompt_executed_id
  const analysisMap = useMemo(() => {
    const map = new Map<string, any>();
    analyses.forEach((a: any) => map.set(a.prompt_executed_id, a));
    return map;
  }, [analyses]);

  // Filter prompts & analyses by selected model
  const { filteredPrompts, filteredAnalyses } = useMemo(() => {
    const fp = selectedModel ? prompts.filter((p: any) => p.model === selectedModel) : prompts;
    const fpIds = new Set(fp.map((p: any) => p.id));
    const fa = analyses.filter((a: any) => fpIds.has(a.prompt_executed_id));
    return { filteredPrompts: fp, filteredAnalyses: fa };
  }, [selectedModel, prompts, analyses]);

  // Recalculate AVI for selected model (or use original for "Tutti")
  const computedAvi = useMemo(() => {
    if (!selectedModel && aviData) {
      return {
        avi_score: aviData.avi_score,
        presence_score: aviData.presence_score,
        rank_score: aviData.rank_score,
        sentiment_score: aviData.sentiment_score,
        stability_score: aviData.stability_score,
      };
    }
    return calculateAVIFromAnalyses(filteredAnalyses, filteredPrompts);
  }, [selectedModel, aviData, filteredAnalyses, filteredPrompts]);

  const showAvi = aviData || (selectedModel && filteredAnalyses.length > 0);
  const noBrandMentions = computedAvi.avi_score === 0 && computedAvi.presence_score === 0;

  return (
    <>
      {/* Model filter pills — positioned right after run metadata */}
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
              {MODEL_LABELS[model] ?? model}
            </button>
          ))}
        </div>
      )}

      {/* AVI Score: Ring + Component Bars */}
      {showAvi && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <RunAVIRing
            score={computedAvi.avi_score}
            trend={selectedModel ? null : trend}
            noBrandMentions={noBrandMentions}
          />
          <AVIBars
            items={AVI_MAIN_COMPONENTS.map((c) => ({
              labelKey: c.labelKey,
              color: c.color,
              descKey: c.descKey,
              value: (computedAvi as any)[c.key] != null ? Math.round((computedAvi as any)[c.key]) : null,
            }))}
            stabilityScore={computedAvi.stability_score}
            showSingleRunNote={totalActiveRuns <= 1 && !selectedModel}
          />
        </div>
      )}

      {/* Consultation CTA after AVI */}
      {showAvi && <ConsultationCTA />}

      {/* Filterable metrics — model filter is now handled by parent */}
      <RunMetrics
        prompts={prompts}
        analyses={analyses}
        sources={sources}
        models={models}
        competitorMentions={competitorMentions}
        brandAviScore={computedAvi.avi_score ?? 0}
        targetBrand={targetBrand}
        queries={queries}
        competitorAviData={competitorAviData}
        externalSelectedModel={selectedModel}
      />

      {/* Segment/Persona analysis */}
      {segments.length > 0 && (
        <SegmentSection
          prompts={prompts}
          analyses={analyses}
          segments={segments}
          queries={queries}
        />
      )}

      {/* Stability section (only if 3+ runs per prompt) */}
      {runCount >= 3 && (
        <StabilitySection
          prompts={prompts}
          analyses={analyses}
          queries={queries}
          runCount={runCount}
        />
      )}
    </>
  );
}

function ConsultationCTA() {
  const { t } = useTranslation();
  const { openModal } = useConsultation();
  return (
    <div className="card p-4 flex items-center justify-between border-[#c4a882]/20 bg-[#c4a882]/5">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("consultation.ctaTitle")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t("consultation.ctaDesc")}</p>
      </div>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#c4a882] border border-[#c4a882]/30 px-4 py-2 rounded-[2px] hover:bg-[#c4a882]/10 transition-colors shrink-0"
      >
        <MessageSquareText className="w-4 h-4" />
        {t("consultation.ctaButton")}
      </button>
    </div>
  );
}

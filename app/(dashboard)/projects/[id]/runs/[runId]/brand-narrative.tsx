"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function BrandNarrative({
  runId,
  targetBrand,
  aviScore,
  presenceScore,
  rankScore,
  sentimentScore,
  topCompetitor,
  topCompetitorAvi,
  locale,
}: {
  runId: string;
  targetBrand: string;
  aviScore: number | null;
  presenceScore: number | null;
  rankScore: number | null;
  sentimentScore: number | null;
  topCompetitor: string | null;
  topCompetitorAvi: number | null;
  locale: string;
}) {
  const { t } = useTranslation();
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(false);

  // Template numbers
  const presencePct = presenceScore != null ? Math.round(presenceScore) : null;
  const aviRounded = aviScore != null ? Math.round(aviScore) : null;
  const rankRounded = rankScore != null ? Math.round(rankScore) : null;

  useEffect(() => {
    if (aviScore == null) return;
    let cancelled = false;
    setInsightLoading(true);
    setInsightError(false);
    fetch(`/api/runs/${runId}/narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_brand: targetBrand,
        avi_score: aviScore,
        presence_score: presenceScore,
        rank_score: rankScore,
        sentiment_score: sentimentScore,
        top_competitor: topCompetitor,
        top_competitor_avi: topCompetitorAvi,
        locale,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) setInsight(data?.insight ?? null);
      })
      .catch(() => {
        if (!cancelled) setInsightError(true);
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, aviScore, presenceScore, rankScore, sentimentScore, topCompetitor, topCompetitorAvi, targetBrand, locale]);

  if (aviScore == null) return null;

  return (
    <div className="card p-5 space-y-3 border border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="font-display font-semibold text-foreground">{t("narrative.title")}</h2>
      </div>

      <p className="text-sm text-foreground leading-relaxed">
        {t("narrative.templateBrand")}{" "}
        <span className="font-semibold text-foreground">{targetBrand}</span>{" "}
        {presencePct != null && (
          <>
            {t("narrative.templatePresence")}{" "}
            <span className="font-semibold text-primary">{presencePct}%</span>{" "}
          </>
        )}
        {rankRounded != null && (
          <>
            {t("narrative.templateRank")}{" "}
            <span className="font-semibold text-primary">{rankRounded}</span>{" "}
          </>
        )}
        {aviRounded != null && (
          <>
            {t("narrative.templateAvi")}{" "}
            <span className="font-semibold text-primary">{aviRounded}</span>.{" "}
          </>
        )}
        {topCompetitor && topCompetitorAvi != null && (
          <>
            {t("narrative.templateTopCompetitor")}{" "}
            <span className="font-semibold text-foreground">{topCompetitor}</span>{" "}
            ({t("narrative.templateAviShort")} {Math.round(topCompetitorAvi)}).
          </>
        )}
      </p>

      {insightLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t("narrative.loadingInsight")}
        </div>
      )}

      {insight && !insightLoading && (
        <div className="pt-2 border-t border-primary/20">
          <p className="text-sm text-foreground leading-relaxed italic">
            <span className="not-italic font-semibold text-primary">{t("narrative.insightLabel")}:</span> {insight}
          </p>
        </div>
      )}

      {insightError && !insightLoading && (
        <p className="text-xs text-muted-foreground">{t("narrative.insightFallback")}</p>
      )}
    </div>
  );
}

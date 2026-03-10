"use client";

import { useState, useMemo } from "react";
import { Globe, Tag, Users, ExternalLink, Eye, Hash, TrendingUp, TrendingDown } from "lucide-react";

interface RunMetricsProps {
  prompts: any[];
  analyses: any[];
  sources: any[];
  models: string[];
  competitorMentions: any[];
  brandAviScore: number;
  targetBrand: string;
}

function sentimentSign(v: number): string {
  return v > 0.1 ? "+" : "";
}

function sentimentColor(v: number): string {
  if (v > 0.1) return "text-success";
  if (v < -0.1) return "text-destructive";
  return "text-muted-foreground";
}

export function RunMetrics({ prompts, analyses, sources, models, competitorMentions, brandAviScore, targetBrand }: RunMetricsProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const filteredPrompts = selectedModel
      ? prompts.filter((p) => p.model === selectedModel)
      : prompts;

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
      : "—";

    const withSentiment = filteredAnalyses.filter((a) => a.sentiment_score !== null);
    const avgSentimentNum = withSentiment.length > 0
      ? withSentiment.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSentiment.length
      : null;
    const avgSentiment = avgSentimentNum != null
      ? `${sentimentSign(avgSentimentNum)}${avgSentimentNum.toFixed(2)}`
      : "—";
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

    // Compute competitor AVI from competitor_mentions filtered by model
    const filteredMentions = selectedModel
      ? competitorMentions.filter((m) => {
          const prompt = prompts.find((p: any) => p.id === m.prompt_executed_id);
          return prompt?.model === selectedModel;
        })
      : competitorMentions;

    const mentionGrouped = new Map<string, any[]>();
    filteredMentions.forEach((m: any) => {
      if (!mentionGrouped.has(m.competitor_name)) mentionGrouped.set(m.competitor_name, []);
      mentionGrouped.get(m.competitor_name)!.push(m);
    });

    const computedCompAviMap: Record<string, number> = {};
    Array.from(mentionGrouped.entries()).forEach(([name, mentions]) => {
      const totalP = filteredPrompts.length;
      const prominence = totalP > 0 ? (mentions.length / totalP) * 100 : 0;
      const withRank = mentions.filter((m: any) => m.rank != null && m.rank > 0);
      const avgR = withRank.length > 0
        ? withRank.reduce((s: number, m: any) => s + m.rank, 0) / withRank.length
        : 3;
      const rankScore = Math.max(0, 100 - ((avgR - 1) * 25));
      const withSent = mentions.filter((m: any) => m.sentiment != null);
      const avgS = withSent.length > 0
        ? withSent.reduce((s: number, m: any) => s + m.sentiment, 0) / withSent.length
        : 0;
      const sentimentScore = ((avgS + 1) / 2) * 100;
      const avi = (prominence * 0.4) + (rankScore * 0.3) + (sentimentScore * 0.3);
      computedCompAviMap[name] = Math.round(avi * 10) / 10;
    });

    const competitorList = Array.from(competitorsMap.entries()).sort((a, b) => {
      const aviA = computedCompAviMap[a[0]] ?? 0;
      const aviB = computedCompAviMap[b[0]] ?? 0;
      return aviB - aviA || b[1] - a[1];
    });

    // Compute brand AVI for selected model
    let brandModelScore: number | null = null;
    if (selectedModel && filteredAnalyses.length > 0) {
      const mentioned = filteredAnalyses.filter((a: any) => a.brand_mentioned).length;
      const presence = (mentioned / filteredAnalyses.length) * 100;
      const rankVals = filteredAnalyses.map((a: any) => {
        if (!a.brand_mentioned || !a.brand_rank || a.brand_rank <= 0) return 0;
        return 1 / a.brand_rank;
      });
      const avgRankInv = rankVals.reduce((s: number, v: number) => s + v, 0) / rankVals.length;
      const rankS = avgRankInv * 100;
      const wSent = filteredAnalyses.filter((a: any) => a.sentiment_score != null);
      const sentAvg = wSent.length > 0 ? wSent.reduce((s: number, a: any) => s + a.sentiment_score, 0) / wSent.length : 0.5;
      const sentS = ((sentAvg + 1) / 2) * 100;
      brandModelScore = Math.round((presence * 0.35 + rankS * 0.25 + sentS * 0.20 + 100 * 0.20) * 10) / 10;
      brandModelScore = Math.max(0, Math.min(100, brandModelScore));
    }

    const topicsMap = new Map<string, number>();
    filteredAnalyses.forEach((a) => {
      (a.topics ?? []).forEach((t: string) => {
        topicsMap.set(t, (topicsMap.get(t) ?? 0) + 1);
      });
    });
    const topicList = Array.from(topicsMap.entries()).sort((a, b) => b[1] - a[1]);

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
      brandModelScore,
      competitorList,
      topicList,
    };
  }, [selectedModel, prompts, analyses, sources, competitorMentions]);

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
    brandModelScore,
    competitorList,
    topicList,
  } = filtered;

  return (
    <>
      {/* Model filter pills */}
      {models.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedModel(null)}
            className="font-mono text-[0.6rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
            style={
              selectedModel === null
                ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
            }
          >
            Tutti
          </button>
          {models.map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className="font-mono text-[0.6rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
              style={
                selectedModel === model
                  ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                  : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
              }
            >
              {model}
            </button>
          ))}
        </div>
      )}

      {/* Brand Mention Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <Eye className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{mentionRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Menzioni Brand</p>
          <p className="text-[10px] text-muted-foreground">{mentionCount}/{totalAnalysed} prompt</p>
        </div>
        <div className="card p-4 text-center">
          <Hash className="w-5 h-5 text-accent mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{totalOccurrences}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Occorrenze Totali</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{avgRank}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rank Medio</p>
          <p className="text-[10px] text-muted-foreground">{ranked.length} risposte con rank</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingDown className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className={`font-display font-bold text-2xl ${avgSentimentColor}`}>{avgSentiment}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sentiment Medio</p>
          <p className="text-[10px] text-muted-foreground">scala -1 / +1</p>
          {avgTone !== null && avgPosition !== null && avgRec !== null && (
            <div className="space-y-1 mt-2">
              {/* Tone */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.5rem] text-muted-foreground w-16">TONE</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px]"
                       style={{
                         width: `${Math.abs(avgTone) * 100}%`,
                         backgroundColor: avgTone >= 0 ? '#7eb89a' : '#c0614a',
                         marginLeft: avgTone < 0 ? `${(1 + avgTone) * 100}%` : '0'
                       }}
                  />
                </div>
                <span className={`font-mono text-[0.5rem] w-8 text-right ${sentimentColor(avgTone)}`}>
                  {sentimentSign(avgTone)}{avgTone.toFixed(2)}
                </span>
              </div>
              {/* Position */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.5rem] text-muted-foreground w-16">POSITION</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px] bg-[#7eb3d4]"
                       style={{ width: `${avgPosition * 100}%` }} />
                </div>
                <span className="font-mono text-[0.5rem] text-muted-foreground w-8 text-right">
                  {avgPosition.toFixed(2)}
                </span>
              </div>
              {/* Recommendation */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.5rem] text-muted-foreground w-16">REC</span>
                <div className="flex-1 h-1 bg-muted rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px]"
                       style={{
                         width: `${Math.abs(avgRec) * 100}%`,
                         backgroundColor: avgRec >= 0 ? '#c4a882' : '#c0614a'
                       }} />
                </div>
                <span className={`font-mono text-[0.5rem] w-8 text-right ${sentimentColor(avgRec)}`}>
                  {sentimentSign(avgRec)}{avgRec.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Benchmark vs Competitors */}
      {competitorList.length > 0 && (() => {
        const effectiveBrandScore = brandModelScore ?? brandAviScore;
        const top5 = competitorList.slice(0, 5).map(([name]) => ({
          name,
          avi: computedCompAviMap[name] ?? 0,
        }));
        return (
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground text-sm">Benchmark</h2>
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
            <h2 className="font-display font-semibold text-foreground">Competitor Trovati</h2>
            <span className="badge badge-muted text-[10px]">{competitorList.length}</span>
          </div>
          {competitorList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun competitor individuato</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {competitorList.map(([name, count]) => {
                const cAvi = computedCompAviMap[name];
                const aviColor = cAvi != null
                  ? cAvi >= 70 ? "text-success" : cAvi >= 40 ? "text-amber-500" : "text-destructive"
                  : "";
                return (
                  <span key={name} className="badge badge-primary flex items-center gap-1.5">
                    {name}
                    <span className="text-[9px] opacity-70">({count})</span>
                    {cAvi != null && (
                      <span className={`text-[10px] font-bold ${aviColor}`}>AVI {cAvi}</span>
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
            <h2 className="font-display font-semibold text-foreground">Topic Emersi</h2>
            <span className="badge badge-muted text-[10px]">{topicList.length}</span>
          </div>
          {topicList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun topic individuato</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topicList.map(([name, count]) => {
                const size = count >= 5 ? "text-sm" : count >= 3 ? "text-xs" : "text-[10px]";
                const opacity = count >= 5 ? "opacity-100" : count >= 3 ? "opacity-80" : "opacity-60";
                return (
                  <span key={name} className={`badge badge-muted ${size} ${opacity}`}>
                    {name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      {filteredSources.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Fonti Estratte</h2>
            <span className="badge badge-muted text-[10px]">{filteredSources.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">URL / Dominio</th>
                  <th className="text-left py-2 pr-4 font-medium">Label</th>
                  <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                  <th className="text-left py-2 font-medium">Brand</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">
                      {s.url ? (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[300px]">{s.url}</span>
                        </span>
                      ) : s.domain ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{s.label ?? "-"}</td>
                    <td className="py-2 pr-4"><span className="badge badge-muted text-[10px]">{s.source_type}</span></td>
                    <td className="py-2">{s.is_brand_owned ? <span className="badge badge-primary text-[10px]">Owned</span> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prompt results table */}
      {filteredPrompts.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-display font-semibold text-foreground">Prompt Eseguiti ({filteredPrompts.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Modello</th>
                  <th className="text-left py-2 pr-3 font-medium">Run</th>
                  <th className="text-left py-2 pr-3 font-medium">Brand</th>
                  <th className="text-left py-2 pr-3 font-medium">Rank</th>
                  <th className="text-left py-2 pr-3 font-medium">Sentiment</th>
                  <th className="text-left py-2 pr-3 font-medium">Competitors</th>
                  <th className="text-left py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrompts.map((p: any, i: number) => {
                  const analysis = analysisMap.get(p.id) as any;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3"><span className="badge badge-muted text-[10px]">{p.model}</span></td>
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
                      <td className="py-2">
                        {p.error
                          ? <span className="badge badge-muted text-destructive text-[10px]">Errore</span>
                          : p.raw_response
                            ? <span className="badge badge-success text-[10px]">OK</span>
                            : <span className="badge badge-muted text-[10px]">Pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Globe, Tag, Users, ExternalLink, Eye, Hash, TrendingUp, TrendingDown } from "lucide-react";

interface RunMetricsProps {
  prompts: any[];
  analyses: any[];
  sources: any[];
  models: string[];
  compAviMap: Record<string, number>;
}

export function RunMetrics({ prompts, analyses, sources, models, compAviMap }: RunMetricsProps) {
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
    const avgSentiment = withSentiment.length > 0
      ? (withSentiment.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSentiment.length).toFixed(2)
      : "—";

    const totalOccurrences = filteredAnalyses.reduce((s: number, a: any) => s + (a.brand_occurrences ?? 0), 0);

    const competitorsMap = new Map<string, number>();
    filteredAnalyses.forEach((a) => {
      (a.competitors_found ?? []).forEach((c: string) => {
        competitorsMap.set(c, (competitorsMap.get(c) ?? 0) + 1);
      });
    });
    const competitorList = Array.from(competitorsMap.entries()).sort((a, b) => {
      const aviA = compAviMap[a[0]] ?? 0;
      const aviB = compAviMap[b[0]] ?? 0;
      return aviB - aviA || b[1] - a[1];
    });

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
      totalOccurrences,
      competitorList,
      topicList,
    };
  }, [selectedModel, prompts, analyses, sources, compAviMap]);

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
    totalOccurrences,
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
          <p className="font-display font-bold text-2xl text-foreground">{avgSentiment}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sentiment Medio</p>
          <p className="text-[10px] text-muted-foreground">scala -1 / +1</p>
        </div>
      </div>

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
                const cAvi = compAviMap[name];
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
                          <span className={analysis.sentiment_score > 0 ? "text-success" : analysis.sentiment_score < 0 ? "text-destructive" : "text-muted-foreground"}>
                            {analysis.sentiment_score > 0 ? "+" : ""}{analysis.sentiment_score.toFixed(2)}
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

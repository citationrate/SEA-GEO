"use client";

import { useState, useMemo } from "react";
import { Users } from "lucide-react";

interface SegmentSectionProps {
  prompts: any[];
  analyses: any[];
  segments: any[];
  queries?: any[];
}

export function SegmentSection({ prompts, analyses, segments, queries }: SegmentSectionProps) {
  const [funnelFilter, setFunnelFilter] = useState<string | null>(null);

  const queryMap = useMemo(() => {
    const map = new Map<string, any>();
    (queries ?? []).forEach((q: any) => map.set(q.id, q));
    return map;
  }, [queries]);

  const analysisMap = useMemo(() => {
    const map = new Map<string, any>();
    analyses.forEach((a: any) => map.set(a.prompt_executed_id, a));
    return map;
  }, [analyses]);

  const segmentMap = useMemo(() => {
    const map = new Map<string, any>();
    segments.forEach((s: any) => map.set(s.id, s));
    return map;
  }, [segments]);

  const data = useMemo(() => {
    // Filter prompts by funnel stage
    let filteredPrompts = [...prompts];
    if (funnelFilter) {
      filteredPrompts = filteredPrompts.filter((p) => {
        const q = queryMap.get(p.query_id);
        return q?.funnel_stage?.toUpperCase() === funnelFilter;
      });
    }

    // Group by segment_id
    const groups = new Map<string, any[]>();
    filteredPrompts.forEach((p) => {
      const segId = p.segment_id || "__general__";
      if (!groups.has(segId)) groups.set(segId, []);
      groups.get(segId)!.push(p);
    });

    // Calculate baseline (general audience)
    const generalPrompts = groups.get("__general__") ?? [];
    let baselineMentionRate = 0;
    if (generalPrompts.length > 0) {
      const generalMentions = generalPrompts.filter((p) => {
        const a = analysisMap.get(p.id);
        return a?.brand_mentioned;
      }).length;
      baselineMentionRate = (generalMentions / generalPrompts.length) * 100;
    }

    // Build rows for each segment
    const rows: {
      segmentId: string;
      label: string;
      totalPrompts: number;
      mentionRate: number;
      avgRank: number | null;
      avgSentiment: number | null;
      lift: number;
    }[] = [];

    groups.forEach((groupPrompts, segId) => {
      const segment = segmentMap.get(segId);
      const label = segId === "__general__" ? "Pubblico generale" : (segment?.label ?? "Segmento sconosciuto");

      const total = groupPrompts.length;
      const mentioned = groupPrompts.filter((p) => {
        const a = analysisMap.get(p.id);
        return a?.brand_mentioned;
      }).length;
      const mentionRate = total > 0 ? (mentioned / total) * 100 : 0;

      const ranks = groupPrompts
        .map((p) => analysisMap.get(p.id))
        .filter((a) => a?.brand_rank != null && a.brand_rank > 0)
        .map((a) => a.brand_rank as number);
      const avgRank = ranks.length > 0 ? ranks.reduce((s, r) => s + r, 0) / ranks.length : null;

      const sentiments = groupPrompts
        .map((p) => analysisMap.get(p.id))
        .filter((a) => a?.sentiment_score != null)
        .map((a) => a.sentiment_score as number);
      const avgSentiment = sentiments.length > 0 ? sentiments.reduce((s, v) => s + v, 0) / sentiments.length : null;

      const lift = mentionRate - baselineMentionRate;

      rows.push({ segmentId: segId, label, totalPrompts: total, mentionRate, avgRank, avgSentiment, lift });
    });

    // Sort: general first, then by mention rate descending
    rows.sort((a, b) => {
      if (a.segmentId === "__general__") return -1;
      if (b.segmentId === "__general__") return 1;
      return b.mentionRate - a.mentionRate;
    });

    return rows;
  }, [prompts, analyses, funnelFilter, queryMap, analysisMap, segmentMap]);

  // Get available funnel stages
  const funnelStages = useMemo(() => {
    const stages = new Set<string>();
    prompts.forEach((p) => {
      const q = queryMap.get(p.query_id);
      if (q?.funnel_stage) stages.add(q.funnel_stage.toUpperCase());
    });
    return Array.from(stages).sort();
  }, [prompts, queryMap]);

  if (data.length <= 1) return null;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#c4a882]" />
          <h2 className="font-display font-semibold text-foreground">Per Segmento</h2>
          <span className="badge badge-muted text-[12px]">{data.length} segmenti</span>
        </div>

        {/* TOFU/MOFU toggle */}
        {funnelStages.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFunnelFilter(null)}
              className="font-mono text-[0.75rem] tracking-wide px-2.5 py-1 rounded-full border transition-colors"
              style={
                funnelFilter === null
                  ? { borderColor: "#e8956d", backgroundColor: "rgba(232,149,109,0.1)", color: "#e8956d" }
                  : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
              }
            >
              Tutti
            </button>
            {funnelStages.map((stage) => (
              <button
                key={stage}
                onClick={() => setFunnelFilter(stage)}
                className="font-mono text-[0.75rem] tracking-wide px-2.5 py-1 rounded-full border transition-colors"
                style={
                  funnelFilter === stage
                    ? { borderColor: "#e8956d", backgroundColor: "rgba(232,149,109,0.1)", color: "#e8956d" }
                    : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
                }
              >
                {stage}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 pr-3 font-medium">Segmento</th>
              <th className="text-center py-2 px-3 font-medium">Prompt</th>
              <th className="text-center py-2 px-3 font-medium">Mention Rate</th>
              <th className="text-center py-2 px-3 font-medium">Rank medio</th>
              <th className="text-center py-2 px-3 font-medium">Sentiment medio</th>
              <th className="text-center py-2 pl-3 font-medium">Lift vs baseline</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isBaseline = row.segmentId === "__general__";
              const liftColor = row.lift > 1 ? "text-success" : row.lift < -1 ? "text-destructive" : "text-muted-foreground";
              const liftSign = row.lift > 0 ? "+" : "";

              return (
                <tr
                  key={row.segmentId}
                  className={`border-b border-border/50 ${isBaseline ? "bg-muted/20" : "hover:bg-muted/30"}`}
                >
                  <td className="py-2.5 pr-3">
                    <span className={`text-foreground ${isBaseline ? "font-medium" : ""}`}>{row.label}</span>
                    {isBaseline && (
                      <span className="ml-2 font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase">baseline</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">{row.totalPrompts}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="font-bold text-foreground">{Math.round(row.mentionRate)}%</span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-foreground">
                    {row.avgRank != null ? row.avgRank.toFixed(1) : "\u2014"}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.avgSentiment != null ? (
                      <span className={row.avgSentiment > 0.1 ? "text-success" : row.avgSentiment < -0.1 ? "text-destructive" : "text-muted-foreground"}>
                        {row.avgSentiment > 0 ? "+" : ""}{row.avgSentiment.toFixed(2)}
                      </span>
                    ) : "\u2014"}
                  </td>
                  <td className="py-2.5 pl-3 text-center">
                    {isBaseline ? (
                      <span className="text-muted-foreground">\u2014</span>
                    ) : (
                      <span className={`font-mono font-bold ${liftColor}`}>
                        {liftSign}{Math.round(row.lift * 10) / 10}pp
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

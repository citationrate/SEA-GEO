"use client";

import { useMemo } from "react";
import { Shield } from "lucide-react";

interface StabilitySectionProps {
  prompts: any[];
  analyses: any[];
  queries: any[];
  runCount: number;
}

export function StabilitySection({ prompts, analyses, queries, runCount }: StabilitySectionProps) {
  const queryMap = useMemo(() => {
    const map = new Map<string, any>();
    queries.forEach((q: any) => map.set(q.id, q));
    return map;
  }, [queries]);

  const analysisMap = useMemo(() => {
    const map = new Map<string, any>();
    analyses.forEach((a: any) => map.set(a.prompt_executed_id, a));
    return map;
  }, [analyses]);

  const stabilityData = useMemo(() => {
    // Group prompts by query_id + model
    const groups = new Map<string, any[]>();
    prompts.forEach((p: any) => {
      const key = `${p.query_id}__${p.model}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });

    const rows: {
      queryText: string;
      model: string;
      runs: { runNumber: number; brandMentioned: boolean | null }[];
      consistency: number;
    }[] = [];

    groups.forEach((groupPrompts, key) => {
      if (groupPrompts.length < 2) return;

      const [queryId, model] = key.split("__");
      const query = queryMap.get(queryId);
      const queryText = query?.text || "N/A";

      const runs = groupPrompts
        .sort((a: any, b: any) => a.run_number - b.run_number)
        .map((p: any) => {
          const a = analysisMap.get(p.id);
          return {
            runNumber: p.run_number,
            brandMentioned: a ? a.brand_mentioned : null,
          };
        });

      // Consistency: percentage of runs that agree on brand_mentioned
      const validRuns = runs.filter((r) => r.brandMentioned !== null);
      if (validRuns.length < 2) return;

      const yesCount = validRuns.filter((r) => r.brandMentioned).length;
      const noCount = validRuns.length - yesCount;
      const majority = Math.max(yesCount, noCount);
      const consistency = Math.round((majority / validRuns.length) * 100);

      rows.push({ queryText, model, runs, consistency });
    });

    return rows.sort((a, b) => a.consistency - b.consistency);
  }, [prompts, analyses, queryMap, analysisMap]);

  if (stabilityData.length === 0) return null;

  const avgConsistency = Math.round(
    stabilityData.reduce((s, r) => s + r.consistency, 0) / stabilityData.length
  );

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#c4a882]" />
          <h2 className="font-display font-semibold text-foreground">Stabilita Risposte</h2>
          <span className="badge badge-muted text-[12px]">{stabilityData.length} query</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">Consistenza media:</span>
          <span className={`font-display font-bold text-sm ${avgConsistency >= 80 ? "text-success" : avgConsistency >= 50 ? "text-yellow-500" : "text-destructive"}`}>
            {avgConsistency}%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 pr-3 font-medium">Query</th>
              <th className="text-left py-2 pr-3 font-medium">Modello</th>
              {Array.from({ length: runCount }, (_, i) => (
                <th key={i} className="text-center py-2 px-2 font-medium">Run {i + 1}</th>
              ))}
              <th className="text-right py-2 pl-3 font-medium">Consistenza</th>
            </tr>
          </thead>
          <tbody>
            {stabilityData.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 pr-3 text-foreground text-xs max-w-[250px] truncate" title={row.queryText}>
                  {row.queryText.slice(0, 50)}{row.queryText.length > 50 ? "..." : ""}
                </td>
                <td className="py-2 pr-3">
                  <span className="badge badge-muted text-[12px]">{row.model}</span>
                </td>
                {Array.from({ length: runCount }, (_, ri) => {
                  const run = row.runs.find((r) => r.runNumber === ri + 1);
                  return (
                    <td key={ri} className="py-2 px-2 text-center">
                      {run == null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : run.brandMentioned === null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : run.brandMentioned ? (
                        <span className="text-success font-medium">Si</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right">
                  <span className={`font-mono text-xs font-bold ${row.consistency >= 80 ? "text-success" : row.consistency >= 50 ? "text-yellow-500" : "text-destructive"}`}>
                    {row.consistency}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

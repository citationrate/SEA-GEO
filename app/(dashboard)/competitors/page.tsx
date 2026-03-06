import { createServerClient } from "@/lib/supabase/server";
import { CompetitorsClient } from "./competitors-client";

export const metadata = { title: "Competitor" };

export default async function CompetitorsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id);

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

  // Fetch competitors with new columns
  const { data: competitors } = projectIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const compList = (competitors ?? []) as any[];

  // Fetch all runs, prompts, and response_analysis for mention counting + sentiment
  const runIds: string[] = [];
  if (projectIds.length > 0) {
    const { data: runs } = await supabase
      .from("analysis_runs")
      .select("id")
      .in("project_id", projectIds);
    (runs ?? []).forEach((r: any) => runIds.push(r.id));
  }

  // Get latest brand AVI
  const { data: lastAviRow } = projectIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("avi_score")
        .in("project_id", projectIds)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Build per-competitor stats from response_analysis
  const compStats = new Map<string, {
    mentions: number;
    sentimentSum: number;
    sentimentCount: number;
    runIds: Set<string>;
    topics: Set<string>;
    queryTypes: Set<string>;
  }>();

  if (runIds.length > 0) {
    const { data: prompts } = await supabase
      .from("prompts_executed")
      .select("id, run_id, query_id")
      .in("run_id", runIds);

    const promptMap = new Map((prompts ?? []).map((p: any) => [p.id, p]));
    const promptIds = (prompts ?? []).map((p: any) => p.id);

    // Get query funnel stages
    const { data: allQueries } = await supabase
      .from("queries")
      .select("id, funnel_stage")
      .in("project_id", projectIds);
    const queryStageMap = new Map((allQueries ?? []).map((q: any) => [q.id, q.funnel_stage]));

    if (promptIds.length > 0) {
      const { data: analyses } = await supabase
        .from("response_analysis")
        .select("prompt_executed_id, competitors_found, sentiment_score, topics")
        .in("prompt_executed_id", promptIds);

      (analyses ?? []).forEach((a: any) => {
        const prompt = promptMap.get(a.prompt_executed_id);
        const queryType = prompt ? queryStageMap.get(prompt.query_id) : null;

        (a.competitors_found ?? []).forEach((name: string) => {
          let stats = compStats.get(name);
          if (!stats) {
            stats = { mentions: 0, sentimentSum: 0, sentimentCount: 0, runIds: new Set(), topics: new Set(), queryTypes: new Set() };
            compStats.set(name, stats);
          }
          stats.mentions++;
          if (a.sentiment_score != null) {
            stats.sentimentSum += a.sentiment_score;
            stats.sentimentCount++;
          }
          if (prompt?.run_id) stats.runIds.add(prompt.run_id);
          (a.topics ?? []).forEach((t: string) => stats!.topics.add(t));
          if (queryType) stats.queryTypes.add(queryType);
        });
      });
    }
  }

  // Build enriched competitor rows
  interface ThemeAnalysis {
    macro_themes?: { theme: string; description: string; keywords: string[]; frequency: number; excerpts?: string[] }[];
    positioning_summary?: string;
  }

  interface CompRow {
    name: string;
    projects: { id: string; name: string; brand: string }[];
    mentions: number;
    analysisCount: number;
    topics: string[];
    queryTypes: string[];
    avgSentiment: number | null;
    firstSeen: string;
    lastSeen: string;
    themeAnalysis: ThemeAnalysis | null;
  }

  const grouped = new Map<string, CompRow>();

  for (const c of compList) {
    const existing = grouped.get(c.name);
    const proj = projectMap.get(c.project_id);
    const projInfo = proj ? { id: proj.id, name: proj.name, brand: proj.target_brand } : null;

    if (existing) {
      if (projInfo && !existing.projects.some((p) => p.id === projInfo.id)) {
        existing.projects.push(projInfo);
      }
      // Merge topic_context from DB record
      for (const t of (c.topic_context ?? [])) {
        if (!existing.topics.includes(t)) existing.topics.push(t);
      }
      if (c.query_type && !existing.queryTypes.includes(c.query_type)) {
        existing.queryTypes.push(c.query_type);
      }
      if (c.created_at < existing.firstSeen) existing.firstSeen = c.created_at;
      if (c.created_at > existing.lastSeen) existing.lastSeen = c.created_at;
    } else {
      grouped.set(c.name, {
        name: c.name,
        projects: projInfo ? [projInfo] : [],
        mentions: 0,
        analysisCount: 0,
        topics: [...(c.topic_context ?? [])],
        queryTypes: c.query_type ? [c.query_type] : [],
        avgSentiment: null,
        firstSeen: c.created_at,
        lastSeen: c.created_at,
        themeAnalysis: c.theme_analysis && Object.keys(c.theme_analysis).length > 0 ? c.theme_analysis : null,
      });
    }
  }

  // Merge stats from response_analysis
  for (const [name, stats] of Array.from(compStats.entries())) {
    const row = grouped.get(name);
    if (row) {
      row.mentions = stats.mentions;
      row.analysisCount = stats.runIds.size;
      row.avgSentiment = stats.sentimentCount > 0 ? stats.sentimentSum / stats.sentimentCount : null;
      Array.from(stats.topics).forEach((t) => { if (!row.topics.includes(t)) row.topics.push(t); });
      Array.from(stats.queryTypes).forEach((qt) => { if (!row.queryTypes.includes(qt)) row.queryTypes.push(qt); });
    } else {
      grouped.set(name, {
        name,
        projects: [],
        mentions: stats.mentions,
        analysisCount: stats.runIds.size,
        topics: Array.from(stats.topics),
        queryTypes: Array.from(stats.queryTypes),
        avgSentiment: stats.sentimentCount > 0 ? stats.sentimentSum / stats.sentimentCount : null,
        firstSeen: "",
        lastSeen: "",
        themeAnalysis: null,
      });
    }
  }

  // Fetch latest competitor AVI scores (from the most recent run per project)
  const compAviMap = new Map<string, number>();
  if (runIds.length > 0) {
    const { data: compAviRows } = await (supabase.from("competitor_avi") as any)
      .select("competitor_name, avi_score, computed_at")
      .in("project_id", projectIds)
      .order("computed_at", { ascending: false });

    // Keep only the latest score per competitor
    for (const row of (compAviRows ?? []) as any[]) {
      if (!compAviMap.has(row.competitor_name)) {
        compAviMap.set(row.competitor_name, row.avi_score);
      }
    }
  }

  // Get brand AVI for benchmark
  const brandAviScore = lastAviRow ? (lastAviRow as any).avi_score : null;

  const rows = Array.from(grouped.values()).sort((a, b) => {
    const aviA = compAviMap.get(a.name) ?? 0;
    const aviB = compAviMap.get(b.name) ?? 0;
    return aviB - aviA || b.mentions - a.mentions;
  });

  // Build all-topics list for "Per Ambito" view
  const allTopics = new Map<string, CompRow[]>();
  for (const row of rows) {
    for (const t of row.topics) {
      if (!allTopics.has(t)) allTopics.set(t, []);
      allTopics.get(t)!.push(row);
    }
  }
  const topicGroups = Array.from(allTopics.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([topic, comps]) => ({ topic, competitors: comps.map((c) => c.name) }));

  return (
    <CompetitorsClient
      rows={rows.map((r) => ({
        ...r,
        aviScore: compAviMap.get(r.name) ?? null,
        projects: r.projects.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
      }))}
      topicGroups={topicGroups}
      projectIds={projectIds}
      brandAviScore={brandAviScore}
    />
  );
}

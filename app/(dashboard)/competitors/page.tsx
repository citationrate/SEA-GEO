import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { ModelSelector } from "@/components/model-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { CompetitorsClient } from "./competitors-client";

export const metadata = { title: "Competitor" };

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  const targetIds = selectedId ? [selectedId] : projectIds;
  const projectMap = new Map(projectsList.map((p: any) => [p.id, p]));

  // Get runs to extract available models + filter
  const { data: allRuns } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, models_used").in("project_id", targetIds)
    : { data: [] };

  const modelsSet = new Set<string>();
  (allRuns ?? []).forEach((r: any) => (r.models_used ?? []).forEach((m: string) => modelsSet.add(m)));
  const availableModels = Array.from(modelsSet).sort();

  const selectedModel = searchParams.model || null;

  let filteredRunIds: string[];
  if (selectedModel && targetIds.length > 0) {
    const { data: filtered } = await supabase
      .from("analysis_runs")
      .select("id")
      .in("project_id", targetIds)
      .contains("models_used", [selectedModel]);
    filteredRunIds = (filtered ?? []).map((r: any) => r.id);
  } else {
    filteredRunIds = (allRuns ?? []).map((r: any) => r.id);
  }

  // Fetch competitors by project_id (mentions filtered via response_analysis below)
  const { data: competitors } = targetIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*")
        .in("project_id", targetIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const compList = (competitors ?? []) as any[];

  // Use filtered run IDs for stats
  const runIds = filteredRunIds;

  // Get latest brand AVI
  const { data: lastAviRow } = targetIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("avi_score")
        .in("project_id", targetIds)
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
      .in("project_id", targetIds);
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

  // Case-insensitive lookup: normalizedName -> original display name
  const grouped = new Map<string, CompRow>();
  const normalizedKeyMap = new Map<string, string>(); // lowercased -> display name

  for (const c of compList) {
    const key = c.name.toLowerCase().trim();
    const existing = grouped.get(key);
    const proj = projectMap.get(c.project_id);
    const projInfo = proj ? { id: proj.id, name: proj.name, brand: proj.target_brand } : null;

    if (existing) {
      if (projInfo && !existing.projects.some((p) => p.id === projInfo.id)) {
        existing.projects.push(projInfo);
      }
      for (const t of (c.topic_context ?? [])) {
        if (!existing.topics.includes(t)) existing.topics.push(t);
      }
      if (c.query_type && !existing.queryTypes.includes(c.query_type)) {
        existing.queryTypes.push(c.query_type);
      }
      if (c.created_at < existing.firstSeen) existing.firstSeen = c.created_at;
      if (c.created_at > existing.lastSeen) existing.lastSeen = c.created_at;
    } else {
      normalizedKeyMap.set(key, c.name);
      grouped.set(key, {
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

  // Merge stats from response_analysis (case-insensitive join)
  for (const [name, stats] of Array.from(compStats.entries())) {
    const key = name.toLowerCase().trim();
    const row = grouped.get(key);
    if (row) {
      row.mentions = stats.mentions;
      row.analysisCount = stats.runIds.size;
      row.avgSentiment = stats.sentimentCount > 0 ? stats.sentimentSum / stats.sentimentCount : null;
      Array.from(stats.topics).forEach((t) => { if (!row.topics.includes(t)) row.topics.push(t); });
      Array.from(stats.queryTypes).forEach((qt) => { if (!row.queryTypes.includes(qt)) row.queryTypes.push(qt); });
    } else {
      grouped.set(key, {
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

  console.log("[competitors] competitors from DB:", compList.length);
  console.log("[competitors] compStats keys:", Array.from(compStats.keys()).slice(0, 5));
  console.log("[competitors] grouped keys:", Array.from(grouped.keys()).slice(0, 5));
  console.log("[competitors] matched stats:", Array.from(compStats.keys()).filter(n => grouped.has(n.toLowerCase().trim())).length, "/", compStats.size);

  // Fetch competitor AVI scores per project (case-insensitive keys)
  const compAviMap = new Map<string, number>();
  for (const pid of targetIds) {
    const { data: compAviRows } = await (supabase.from("competitor_avi") as any)
      .select("competitor_name, avi_score")
      .eq("project_id", pid)
      .order("computed_at", { ascending: false });

    for (const row of (compAviRows ?? []) as any[]) {
      const key = row.competitor_name.toLowerCase().trim();
      if (!compAviMap.has(key)) {
        compAviMap.set(key, Math.round(row.avi_score * 10) / 10);
      }
    }
  }

  // Get brand AVI for benchmark
  const brandAviScore = lastAviRow ? Math.round((lastAviRow as any).avi_score * 10) / 10 : null;

  const rows = Array.from(grouped.values()).sort((a, b) => {
    const aviA = compAviMap.get(a.name.toLowerCase().trim()) ?? 0;
    const aviB = compAviMap.get(b.name.toLowerCase().trim()) ?? 0;
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
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-end gap-3">
        <ModelSelector models={availableModels} />
        <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
      </div>
      <CompetitorsClient
        rows={rows.map((r) => ({
          ...r,
          aviScore: compAviMap.get(r.name.toLowerCase().trim()) ?? null,
          projects: r.projects.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
        }))}
        topicGroups={topicGroups}
        projectIds={targetIds}
        brandAviScore={brandAviScore}
      />
    </div>
  );
}

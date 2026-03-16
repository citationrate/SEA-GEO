import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ProjectSelector } from "@/components/project-selector";

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

  // Get runs to extract available models + filter (exclude archived)
  const { data: allRuns } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, models_used").in("project_id", targetIds).is("deleted_at", null)
    : { data: [] };

  const selectedModel = searchParams.model || null;

  // Active (non-archived) run IDs
  const activeRunIds = (allRuns ?? []).map((r: any) => r.id);

  // Fetch all competitors (discovery is not model-specific, filtering happens via mentions)
  const { data: competitors } = activeRunIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*")
        .in("project_id", targetIds)
        .in("discovered_at_run_id", activeRunIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const compList = (competitors ?? []) as any[];

  // ── Model-level filtering via prompts_executed ──
  // When a model is selected, filter at the prompt level (not run level),
  // because a single run can contain data from multiple models.
  let filteredPromptIds: string[] | null = null; // null = no filter (all)

  // Fetch all prompts for active runs (needed for stats)
  const { data: allPrompts } = activeRunIds.length > 0
    ? await supabase
        .from("prompts_executed")
        .select("id, run_id, query_id, model")
        .in("run_id", activeRunIds)
    : { data: [] };

  const allPromptsList = (allPrompts ?? []) as any[];

  if (selectedModel) {
    filteredPromptIds = allPromptsList
      .filter((p: any) => p.model === selectedModel)
      .map((p: any) => p.id);
  }

  // The prompts to use for stats (filtered by model if selected)
  const effectivePrompts = selectedModel
    ? allPromptsList.filter((p: any) => p.model === selectedModel)
    : allPromptsList;
  const effectivePromptIds = effectivePrompts.map((p: any) => p.id);

  // Fetch mention counts from competitor_mentions filtered by prompt IDs
  let mentionQuery;
  if (filteredPromptIds && filteredPromptIds.length > 0) {
    mentionQuery = await (supabase.from("competitor_mentions") as any)
      .select("competitor_name, competitor_type")
      .in("project_id", targetIds)
      .in("prompt_executed_id", filteredPromptIds);
  } else if (!selectedModel && activeRunIds.length > 0) {
    mentionQuery = await (supabase.from("competitor_mentions") as any)
      .select("competitor_name, competitor_type")
      .in("project_id", targetIds)
      .in("run_id", activeRunIds);
  } else {
    mentionQuery = { data: [] };
  }
  const allMentionRows = mentionQuery.data ?? [];

  const totalMentionMap = new Map<string, number>();
  const compTypeMap = new Map<string, string>();
  for (const m of allMentionRows as any[]) {
    const key = (m.competitor_name as string).toLowerCase().trim();
    totalMentionMap.set(key, (totalMentionMap.get(key) ?? 0) + 1);
    if (m.competitor_type) compTypeMap.set(key, m.competitor_type);
  }

  // Build per-model mention map for each competitor (always uses all data for badges)
  const perModelMentionMap = new Map<string, Set<string>>();
  if (activeRunIds.length > 0) {
    const { data: mentionRowsWithRun } = await (supabase.from("competitor_mentions") as any)
      .select("competitor_name, prompt_executed_id")
      .in("project_id", targetIds)
      .in("run_id", activeRunIds);

    const promptModelMap = new Map(allPromptsList.map((p: any) => [p.id, p.model]));

    for (const m of (mentionRowsWithRun ?? []) as any[]) {
      const key = (m.competitor_name as string).toLowerCase().trim();
      if (!perModelMentionMap.has(key)) perModelMentionMap.set(key, new Set());
      const model = promptModelMap.get(m.prompt_executed_id);
      if (model) perModelMentionMap.get(key)!.add(model);
    }
  }

  // Get latest brand AVI
  const { data: lastAviRow } = activeRunIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("avi_score")
        .in("project_id", targetIds)
        .in("run_id", activeRunIds)
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

  let totalPrompts = effectivePromptIds.length;

  if (effectivePromptIds.length > 0) {
    const promptMap = new Map(effectivePrompts.map((p: any) => [p.id, p]));

    // Get query funnel stages
    const { data: allQueries } = await supabase
      .from("queries")
      .select("id, funnel_stage")
      .in("project_id", targetIds);
    const queryStageMap = new Map((allQueries ?? []).map((q: any) => [q.id, q.funnel_stage]));

    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("prompt_executed_id, competitors_found, sentiment_score, topics")
      .in("prompt_executed_id", effectivePromptIds);

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
    competitorType: string;
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
      if (c.created_at < existing.firstSeen) existing.firstSeen = c.created_at;
      if (c.created_at > existing.lastSeen) existing.lastSeen = c.created_at;
    } else {
      normalizedKeyMap.set(key, c.name);
      grouped.set(key, {
        name: c.name,
        projects: projInfo ? [projInfo] : [],
        mentions: 0,
        analysisCount: 0,
        topics: [],
        queryTypes: [],
        avgSentiment: null,
        firstSeen: c.created_at,
        lastSeen: c.created_at,
        themeAnalysis: c.theme_analysis && Object.keys(c.theme_analysis).length > 0 ? c.theme_analysis : null,
        competitorType: compTypeMap.get(key) ?? "direct",
      });
    }
  }

  // Merge stats from response_analysis (case-insensitive join)
  for (const [name, stats] of Array.from(compStats.entries())) {
    const key = name.toLowerCase().trim();
    const row = grouped.get(key);
    if (row) {
      // Use total historical mentions from competitor_mentions, fallback to response_analysis count
      row.mentions = totalMentionMap.get(key) ?? stats.mentions;
      row.analysisCount = stats.runIds.size;
      row.avgSentiment = stats.sentimentCount > 0 ? stats.sentimentSum / stats.sentimentCount : null;
      Array.from(stats.topics).forEach((t) => { if (!row.topics.includes(t)) row.topics.push(t); });
      Array.from(stats.queryTypes).forEach((qt) => { if (!row.queryTypes.includes(qt)) row.queryTypes.push(qt); });
    } else {
      grouped.set(key, {
        name,
        projects: [],
        mentions: totalMentionMap.get(key) ?? stats.mentions,
        analysisCount: stats.runIds.size,
        topics: Array.from(stats.topics),
        queryTypes: Array.from(stats.queryTypes),
        avgSentiment: stats.sentimentCount > 0 ? stats.sentimentSum / stats.sentimentCount : null,
        firstSeen: "",
        lastSeen: "",
        themeAnalysis: null,
        competitorType: compTypeMap.get(key) ?? "direct",
      });
    }
  }

  // Also apply total historical mentions to competitors that have mentions but weren't in compStats
  for (const [key, row] of Array.from(grouped.entries())) {
    if (row.mentions === 0 && totalMentionMap.has(key)) {
      row.mentions = totalMentionMap.get(key)!;
    }
  }

  // Fetch competitor AVI scores per project (case-insensitive keys)
  const compAviMap = new Map<string, number>();
  for (const pid of targetIds) {
    const svc = createServiceClient();
    const { data: compAviRows } = await (svc.from("competitor_avi") as any)
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
    const aviA = compAviMap.get(a.name.toLowerCase().trim()) ?? (totalPrompts > 0 ? (a.mentions / totalPrompts) * 100 : 0);
    const aviB = compAviMap.get(b.name.toLowerCase().trim()) ?? (totalPrompts > 0 ? (b.mentions / totalPrompts) * 100 : 0);
    return aviB - aviA || b.mentions - a.mentions;
  });

  // Extract all available models from runs
  const availableModels = Array.from(new Set((allRuns ?? []).flatMap((r: any) => r.models_used ?? []))) as string[];

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div data-tour="competitors-tab" className="flex items-center justify-end gap-3">
        <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
      </div>
      <Suspense fallback={null}>
      <CompetitorsClient
        rows={rows.map((r) => {
          const key = r.name.toLowerCase().trim();
          const modelSet = perModelMentionMap.get(key);
          const modelMentions: Record<string, boolean> = {};
          for (const m of availableModels) {
            modelMentions[m] = modelSet?.has(m) ?? false;
          }
          return {
            ...r,
            aviScore: compAviMap.get(key) ?? null,
            mentionScore: totalPrompts > 0 ? Math.round((r.mentions / totalPrompts) * 1000) / 10 : null,
            competitorType: r.competitorType,
            projects: r.projects.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
            modelMentions,
          };
        })}
        projectIds={targetIds}
        brandAviScore={brandAviScore}
        availableModels={availableModels}
        selectedModel={selectedModel}
      />
      </Suspense>
    </div>
  );
}

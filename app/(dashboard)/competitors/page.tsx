import { Suspense } from "react";
import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";

import { resolveProjectId } from "@/lib/utils/resolve-project";
import { CompetitorsClient } from "./competitors-client";

export const metadata = { title: "Competitor" };

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const auth = createServerClient();
  // Cookie-only auth — middleware already gates this route.
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const supabase = createDataClient();
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

  const selectedModel = searchParams.model || null;

  // ── Phase 1: runs + queries fan-out (independent of each other) ──
  const [allRunsRes, queriesRes] = await Promise.all([
    targetIds.length > 0
      ? supabase.from("analysis_runs").select("id, models_used").in("project_id", targetIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as any[] }),
    targetIds.length > 0
      ? supabase.from("queries").select("id, funnel_stage").in("project_id", targetIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const allRuns = ((allRunsRes as any).data ?? []) as any[];
  const allQueries = ((queriesRes as any).data ?? []) as any[];
  const queryStageMap = new Map(allQueries.map((q: any) => [q.id, q.funnel_stage]));

  const activeRunIds = allRuns.map((r: any) => r.id);

  // ── Phase 2: every read that depends on activeRunIds in a single fan-out ──
  // Original code:
  //   - issued competitor_mentions twice (filtered + per-model variant),
  //   - looped per-project on competitor_avi (N+1),
  //   - and ran competitors / prompts / avi_history sequentially.
  // We collapse them into ONE Promise.all. competitor_mentions is fetched
  // once with all the columns both downstream consumers need; competitor_avi
  // becomes a single global query that we partition in JS to preserve the
  // original "first project, latest score wins" semantic exactly.
  const [
    competitorsRes,
    allPromptsRes,
    allMentionsRes,
    lastAviRowRes,
    compAviRowsRes,
  ] = await Promise.all([
    activeRunIds.length > 0
      ? supabase
          .from("competitors")
          .select("*")
          .in("project_id", targetIds)
          .in("discovered_at_run_id", activeRunIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    activeRunIds.length > 0
      ? supabase
          .from("prompts_executed")
          .select("id, run_id, query_id, model")
          .in("run_id", activeRunIds)
      : Promise.resolve({ data: [] as any[] }),
    activeRunIds.length > 0
      ? (supabase.from("competitor_mentions") as any)
          .select("competitor_name, competitor_type, prompt_executed_id, run_id")
          .in("project_id", targetIds)
          .in("run_id", activeRunIds)
      : Promise.resolve({ data: [] as any[] }),
    activeRunIds.length > 0
      ? supabase
          .from("avi_history")
          .select("avi_score")
          .in("project_id", targetIds)
          .in("run_id", activeRunIds)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    targetIds.length > 0
      ? (supabase.from("competitor_avi") as any)
          .select("competitor_name, avi_score, project_id, computed_at")
          .in("project_id", targetIds)
          .order("computed_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const compList = (((competitorsRes as any).data ?? []) as any[]);
  const allPromptsList = (((allPromptsRes as any).data ?? []) as any[]);
  const allMentionRowsAll = (((allMentionsRes as any).data ?? []) as any[]);
  const lastAviRow = (lastAviRowRes as any).data;
  const allCompAviRows = (((compAviRowsRes as any).data ?? []) as any[]);

  // ── Build prompt → model map (used by both stats and per-model badges) ──
  const promptModelMap = new Map(allPromptsList.map((p: any) => [p.id, p.model]));

  // ── Filtered prompt set (stats + first mention query both use it) ──
  const effectivePrompts = selectedModel
    ? allPromptsList.filter((p: any) => p.model === selectedModel)
    : allPromptsList;
  const effectivePromptIds = effectivePrompts.map((p: any) => p.id);
  const effectivePromptIdSet = new Set<string>(effectivePromptIds);

  // ── Mentions: filter the unified result set in JS for both consumers ──
  // Stats use mentions only from the effective (model-filtered) prompts;
  // the per-model badge map uses ALL mentions to know which models touched
  // each competitor across the full run set.
  const totalMentionMap = new Map<string, number>();
  const compTypeMap = new Map<string, string>();
  const perModelMentionMap = new Map<string, Set<string>>();

  for (const m of allMentionRowsAll) {
    const key = (m.competitor_name as string).toLowerCase().trim();
    if (m.competitor_type) compTypeMap.set(key, m.competitor_type);

    // Per-model badge — ALWAYS counts every mention we have.
    const model = promptModelMap.get(m.prompt_executed_id);
    if (model) {
      if (!perModelMentionMap.has(key)) perModelMentionMap.set(key, new Set());
      perModelMentionMap.get(key)!.add(model);
    }

    // Effective mention count — only counts mentions tied to a prompt the
    // current model filter accepts. When no model is selected,
    // effectivePromptIdSet contains every prompt id, so all mentions count.
    if (effectivePromptIdSet.has(m.prompt_executed_id)) {
      totalMentionMap.set(key, (totalMentionMap.get(key) ?? 0) + 1);
    }
  }

  // ── response_analysis depends on the effective prompt id set ──
  const { data: analyses } = effectivePromptIds.length > 0
    ? await supabase
        .from("response_analysis")
        .select("prompt_executed_id, competitors_found, sentiment_score, topics, brand_mentioned")
        .in("prompt_executed_id", effectivePromptIds)
    : { data: [] as any[] };

  const compStats = new Map<string, {
    mentions: number;
    sentimentSum: number;
    sentimentCount: number;
    runIds: Set<string>;
    topics: Set<string>;
    queryTypes: Set<string>;
  }>();

  let totalPrompts = effectivePromptIds.length;
  let brandMentionedCount = 0;
  const promptMap = new Map(effectivePrompts.map((p: any) => [p.id, p]));

  (analyses ?? []).forEach((a: any) => {
    const prompt = promptMap.get(a.prompt_executed_id);
    const queryType = prompt ? queryStageMap.get((prompt as any).query_id) : null;
    if (a.brand_mentioned) brandMentionedCount++;

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
      if ((prompt as any)?.run_id) stats.runIds.add((prompt as any).run_id);
      (a.topics ?? []).forEach((t: string) => stats!.topics.add(t));
      if (queryType) stats.queryTypes.add(queryType);
    });
  });

  // ── Build enriched competitor rows ──
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

  const grouped = new Map<string, CompRow>();
  const normalizedKeyMap = new Map<string, string>();

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

  for (const [name, stats] of Array.from(compStats.entries())) {
    const key = name.toLowerCase().trim();
    const row = grouped.get(key);
    if (row) {
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

  for (const [key, row] of Array.from(grouped.entries())) {
    if (row.mentions === 0 && totalMentionMap.has(key)) {
      row.mentions = totalMentionMap.get(key)!;
    }
  }

  // ── Competitor AVI scores: same semantic as the original per-project loop,
  // but partitioned in JS from a single query. For each project (in the
  // original targetIds order), the latest computed_at score wins per
  // competitor name, and earlier projects take precedence. ──
  const compAviMap = new Map<string, number>();
  // Pre-bucket by project — rows already arrive sorted by computed_at DESC
  // so we just have to walk them once per project.
  const aviByProject = new Map<string, any[]>();
  for (const row of allCompAviRows) {
    const arr = aviByProject.get(row.project_id) ?? [];
    arr.push(row);
    aviByProject.set(row.project_id, arr);
  }
  for (const pid of targetIds) {
    const rows = aviByProject.get(pid) ?? [];
    for (const row of rows) {
      const key = (row.competitor_name as string).toLowerCase().trim();
      if (!compAviMap.has(key)) {
        compAviMap.set(key, Math.round(row.avi_score * 10) / 10);
      }
    }
  }

  // Get brand AVI for benchmark.
  const globalBrandAvi = lastAviRow ? Math.round((lastAviRow as any).avi_score * 10) / 10 : null;
  const brandMentionScore = totalPrompts > 0
    ? Math.round((brandMentionedCount / totalPrompts) * 1000) / 10
    : null;
  const brandAviScore = selectedModel ? brandMentionScore : globalBrandAvi;

  const rows = Array.from(grouped.values()).sort((a, b) => {
    const aviA = compAviMap.get(a.name.toLowerCase().trim()) ?? (totalPrompts > 0 ? (a.mentions / totalPrompts) * 100 : 0);
    const aviB = compAviMap.get(b.name.toLowerCase().trim()) ?? (totalPrompts > 0 ? (b.mentions / totalPrompts) * 100 : 0);
    return aviB - aviA || b.mentions - a.mentions;
  });

  const availableModels = Array.from(new Set(allRuns.flatMap((r: any) => r.models_used ?? []))) as string[];

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

import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { TopicsClient } from "./topics-client";
import { TopicsHeader, TopicsEmpty } from "./topics-header";

export const metadata = { title: "Topic" };

export default async function TopicsPage({
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
  const projectIds = projectsList.map((p) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  const targetProjects = selectedId
    ? projectsList.filter((p) => p.id === selectedId)
    : projectsList;

  const targetIds = targetProjects.map((p: any) => p.id);

  // Resolve brand name
  const brand = selectedId
    ? (projectsList.find((p: any) => p.id === selectedId)?.target_brand ?? "Brand")
    : (projectsList[0]?.target_brand ?? "Brand");

  const selectedModel = searchParams.model || null;

  // ── Phase 1: parallel fetch of runs (filtered + unfiltered) and queries ──
  // analysis_runs is the source of truth for `models_used`. queries gives us
  // the funnel_stage map needed later.
  const [allRunsRes, filteredRunsRes, queriesRes] = await Promise.all([
    targetIds.length > 0
      ? supabase.from("analysis_runs").select("id, project_id, models_used").in("project_id", targetIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as any[] }),
    selectedModel && targetIds.length > 0
      ? supabase
          .from("analysis_runs")
          .select("id, project_id")
          .in("project_id", targetIds)
          .is("deleted_at", null)
          .contains("models_used", [selectedModel])
      : Promise.resolve({ data: null }),
    targetIds.length > 0
      ? supabase.from("queries").select("id, funnel_stage").in("project_id", targetIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const allRuns = ((allRunsRes as any).data ?? []) as any[];
  const filteredRunIds: string[] = selectedModel
    ? (((filteredRunsRes as any).data ?? []) as any[]).map((r: any) => r.id)
    : allRuns.map((r: any) => r.id);
  const allQueries = ((queriesRes as any).data ?? []) as any[];
  const queryStageMap = new Map(allQueries.map((q: any) => [q.id, q.funnel_stage]));

  // ── Phase 2: single global fetch instead of looping per-project ──
  // The original code looped over projects and ran two queries per project
  // (prompts_executed + response_analysis), producing N×2 round-trips.
  // We collapse it into two global queries scoped by all the run ids we care
  // about, then partition in JS — same data, dramatically less network.
  let prompts: any[] = [];
  let analyses: any[] = [];
  if (filteredRunIds.length > 0) {
    const [promptsRes] = await Promise.all([
      supabase
        .from("prompts_executed")
        .select("id, run_id, query_id")
        .in("run_id", filteredRunIds),
    ]);
    prompts = (((promptsRes as any).data ?? []) as any[]);
    const promptIds = prompts.map((p: any) => p.id);
    if (promptIds.length > 0) {
      const { data: ar } = await supabase
        .from("response_analysis")
        .select("prompt_executed_id, topics, brand_mentioned")
        .in("prompt_executed_id", promptIds)
        .eq("brand_mentioned", true);
      analyses = (ar ?? []) as any[];
    }
  }

  // Index the prompt → query lookup once.
  const promptQueryMap = new Map(prompts.map((p: any) => [p.id, p.query_id]));

  // ── Aggregate topic stats globally (no per-project loop needed) ──
  interface TopicStats {
    count: number;
    tofu: number;
    mofu: number;
    bofu: number;
  }
  const globalStats = new Map<string, TopicStats>();

  analyses.forEach((a: any) => {
    const queryId = promptQueryMap.get(a.prompt_executed_id);
    const stage = queryId ? queryStageMap.get(queryId) : null;

    (a.topics ?? []).forEach((t: string) => {
      let stats = globalStats.get(t);
      if (!stats) {
        stats = { count: 0, tofu: 0, mofu: 0, bofu: 0 };
        globalStats.set(t, stats);
      }
      stats.count++;
      if (stage === "tofu") stats.tofu++;
      else if (stage === "mofu") stats.mofu++;
      else if (stage === "bofu") stats.bofu++;
    });
  });

  // Compute relevance_score and filter
  const topicItems = Array.from(globalStats.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      relevanceScore: stats.mofu * 2 + stats.tofu * 1 + stats.bofu * 1,
      funnelBreakdown: { tofu: stats.tofu, mofu: stats.mofu, bofu: stats.bofu },
    }))
    .filter((t) => t.count >= 1)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.count - a.count);

  return (
    <div data-tour="topics-page" className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <TopicsHeader count={topicItems.length} />
        <div className="flex items-center gap-3">
          <ProjectSelector projects={projectsList.map((p) => ({ id: p.id, name: p.name }))} />
        </div>
      </div>

      {topicItems.length === 0 ? (
        <TopicsEmpty />
      ) : (
        <TopicsClient topics={topicItems} brand={brand} />
      )}
    </div>
  );
}

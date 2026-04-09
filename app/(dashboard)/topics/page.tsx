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
  const { data: { user } } = await auth.auth.getUser();
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

  // Get runs to extract available models + filter (exclude archived)
  const { data: allRuns } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, project_id, models_used").in("project_id", targetIds).is("deleted_at", null)
    : { data: [] };

  const selectedModel = searchParams.model || null;

  let filteredRunIds: string[];
  if (selectedModel && targetIds.length > 0) {
    const { data: filtered } = await supabase
      .from("analysis_runs")
      .select("id, project_id")
      .in("project_id", targetIds)
      .is("deleted_at", null)
      .contains("models_used", [selectedModel]);
    filteredRunIds = (filtered ?? []).map((r: any) => r.id);
  } else {
    filteredRunIds = (allRuns ?? []).map((r: any) => r.id);
  }

  // Get query funnel stages for relevance weighting
  const { data: allQueries } = targetIds.length > 0
    ? await supabase.from("queries").select("id, funnel_stage").in("project_id", targetIds)
    : { data: [] };
  const queryStageMap = new Map((allQueries ?? []).map((q: any) => [q.id, q.funnel_stage]));

  // Build topic stats with funnel weighting
  interface TopicStats {
    count: number;
    tofu: number;
    mofu: number;
    bofu: number;
  }
  const globalStats = new Map<string, TopicStats>();

  for (const proj of targetProjects) {
    const projRunIds = filteredRunIds.filter((rid: string) =>
      (allRuns ?? []).find((r: any) => r.id === rid && r.project_id === proj.id),
    );
    if (projRunIds.length === 0) continue;

    const { data: prompts } = await supabase
      .from("prompts_executed")
      .select("id, query_id")
      .in("run_id", projRunIds);

    const promptList = (prompts ?? []) as any[];
    const promptIds = promptList.map((p: any) => p.id);
    const promptQueryMap = new Map(promptList.map((p: any) => [p.id, p.query_id]));
    if (promptIds.length === 0) continue;

    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("prompt_executed_id, topics, brand_mentioned")
      .in("prompt_executed_id", promptIds)
      .eq("brand_mentioned", true);

    (analyses ?? []).forEach((a: any) => {
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
  }

  // Compute relevance_score and filter
  const topicItems = Array.from(globalStats.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      relevanceScore: stats.mofu * 2 + stats.tofu * 1 + stats.bofu * 1,
      funnelBreakdown: { tofu: stats.tofu, mofu: stats.mofu, bofu: stats.bofu },
    }))
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.count - a.count);

  // Extract available models for filter pills
  const availableModels = Array.from(
    new Set((allRuns ?? []).flatMap((r: any) => r.models_used ?? [])),
  ) as string[];

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

import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { DemoBanner } from "@/components/dashboard/demo-banner";

import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const auth = createServerClient();
  // Use getSession() — reads the JWT from the cookie without an Auth API
  // round-trip. Saves ~50-100ms on every dashboard render. We trust the
  // signed cookie because middleware.ts already gates this route.
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return <DashboardClient aviScore={null} aviTrend={null} stats={[]} trendData={[]} recentRuns={[]} competitorBarData={[]} projects={[]} />;

  const supabase = createDataClient();

  // ── Phase 1: independent fetches that don't depend on each other ──
  // Plan + projects can fire in parallel — neither needs the other.
  const [
    profileRes,
    projectsRes,
  ] = await Promise.all([
    (supabase.from("profiles") as any)
      .select("plan")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, name, target_brand, models_config")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const userProfile = (profileRes as any).data;
  const projects = (projectsRes as any).data;

  const userPlan = (userProfile as any)?.plan ?? "demo";
  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  const targetIds = selectedId ? [selectedId] : projectIds;
  const projectMap = new Map(projectsList.map((p: any) => [p.id, p]));

  // ── Phase 2: fetch all runs (needed to discover models + filter) ──
  const { data: allRuns } = targetIds.length > 0
    ? await supabase
        .from("analysis_runs")
        .select("*")
        .in("project_id", targetIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Extract available models
  const modelsSet = new Set<string>();
  (allRuns ?? []).forEach((r: any) => (r.models_used ?? []).forEach((m: string) => modelsSet.add(m)));

  // Filter runs by selected model — only re-query if a model filter is active.
  // Otherwise reuse allRuns (saves one round-trip in the common case).
  const selectedModel = searchParams.model || null;
  let runs: any[];
  if (selectedModel && targetIds.length > 0) {
    const { data: filtered } = await supabase
      .from("analysis_runs")
      .select("*")
      .in("project_id", targetIds)
      .is("deleted_at", null)
      .contains("models_used", [selectedModel])
      .order("created_at", { ascending: false });
    runs = filtered ?? [];
  } else {
    runs = allRuns ?? [];
  }

  const runIds = runs.map((r: any) => r.id);
  const activeProjectId = selectedId ?? projectIds[0] ?? null;

  // ── Phase 3: fan-out everything that depends on runIds / targetIds ──
  // This is where the original code was paying ~10 sequential round-trips.
  // All these queries are independent and read-only — Promise.all collapses
  // them into a single network burst.
  const [
    aviHistoryRes,
    totalPromptsRes,
    competitorsCountRes,
    sourcesCountRes,
    promptsForCitationsRes,
    promptsForMentionRes,
    queryCountRes,
    segmentCountRes,
  ] = await Promise.all([
    // AVI history
    runIds.length > 0
      ? supabase
          .from("avi_history")
          .select("avi_score, presence_score, rank_score, sentiment_score, stability_score, computed_at, run_id")
          .in("run_id", runIds)
          .order("computed_at", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    // Total prompts executed
    runIds.length > 0
      ? supabase
          .from("prompts_executed")
          .select("*", { count: "exact", head: true })
          .in("run_id", runIds)
      : Promise.resolve({ count: 0 }),
    // Competitors count
    targetIds.length > 0
      ? supabase
          .from("competitors")
          .select("*", { count: "exact", head: true })
          .in("project_id", targetIds)
      : Promise.resolve({ count: 0 }),
    // Sources count
    targetIds.length > 0
      ? supabase
          .from("sources")
          .select("*", { count: "exact", head: true })
          .in("project_id", targetIds)
      : Promise.resolve({ count: 0 }),
    // Prompts with citation_urls (for AI-consulted % later)
    runIds.length > 0
      ? supabase.from("prompts_executed").select("id, citation_urls").in("run_id", runIds)
      : Promise.resolve({ data: [] as any[] }),
    // Prompts ids (for mention rate later)
    runIds.length > 0
      ? supabase.from("prompts_executed").select("id").in("run_id", runIds)
      : Promise.resolve({ data: [] as any[] }),
    // Query count for active project
    activeProjectId
      ? supabase
          .from("queries")
          .select("*", { count: "exact", head: true })
          .eq("project_id", activeProjectId)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
    // Segment count for active project
    activeProjectId
      ? supabase
          .from("audience_segments")
          .select("*", { count: "exact", head: true })
          .eq("project_id", activeProjectId)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const aviList = ((aviHistoryRes as any).data ?? []) as any[];
  const lastAvi = aviList.length > 0 ? aviList[aviList.length - 1] : null;
  const prevAvi = aviList.length > 1 ? aviList[aviList.length - 2] : null;

  const aviScore = lastAvi?.avi_score ?? null;
  const aviTrend = lastAvi && prevAvi ? lastAvi.avi_score - prevAvi.avi_score : null;
  const noBrandMentions = lastAvi != null && lastAvi.avi_score === 0 && lastAvi.presence_score === 0;

  const totalPrompts = (totalPromptsRes as any).count ?? 0;
  const competitorsCount = (competitorsCountRes as any).count ?? 0;
  const sourcesCount = (sourcesCountRes as any).count ?? 0;
  const projectQueryCount = (queryCountRes as any).count ?? 0;
  const projectSegmentCount = (segmentCountRes as any).count ?? 0;

  const promptsForCitations = (((promptsForCitationsRes as any).data ?? []) as any[]);
  const promptsForMention = (((promptsForMentionRes as any).data ?? []) as any[]);

  // ── Phase 4: derived queries that need the prompt id sets we just got ──
  const withCitations = promptsForCitations.filter((p: any) => p.citation_urls && p.citation_urls.length > 0);
  const promptIdsWithCitations = withCitations.map((p: any) => p.id);
  const promptIdsForMention = promptsForMention.map((p: any) => p.id);

  // Latest completed run drives the competitor bar — find it before fan-out.
  const latestCompletedRun = runs.find((r: any) => r.status === "completed");

  const [
    analysisRowsRes,
    totalAnalysesRes,
    mentionedCountRes,
    compAviRowsRes,
  ] = await Promise.all([
    promptIdsWithCitations.length > 0
      ? supabase
          .from("response_analysis")
          .select("brand_in_citations")
          .in("prompt_executed_id", promptIdsWithCitations)
      : Promise.resolve({ data: [] as any[] }),
    promptIdsForMention.length > 0
      ? supabase
          .from("response_analysis")
          .select("*", { count: "exact", head: true })
          .in("prompt_executed_id", promptIdsForMention)
      : Promise.resolve({ count: 0 }),
    promptIdsForMention.length > 0
      ? supabase
          .from("response_analysis")
          .select("*", { count: "exact", head: true })
          .in("prompt_executed_id", promptIdsForMention)
          .eq("brand_mentioned", true)
      : Promise.resolve({ count: 0 }),
    latestCompletedRun
      ? (supabase.from("competitor_avi") as any)
          .select("competitor_name, avi_score")
          .eq("run_id", (latestCompletedRun as any).id)
          .order("avi_score", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // AI-consulted citations percentage
  let aiConsultedPct = "--";
  if (withCitations.length > 0) {
    const analysisRows = ((analysisRowsRes as any).data ?? []) as any[];
    const brandInCount = analysisRows.filter((r: any) => r.brand_in_citations).length;
    aiConsultedPct = `${Math.round((brandInCount / withCitations.length) * 100)}%`;
  }

  // Brand mention rate
  let mentionRate = "--";
  const totalAnalyses = (totalAnalysesRes as any).count ?? 0;
  const mentionedCount = (mentionedCountRes as any).count ?? 0;
  if (totalAnalyses > 0) {
    mentionRate = `${Math.round((mentionedCount / totalAnalyses) * 100)}%`;
  }

  // Build AVI components for ring
  const aviComponents = lastAvi ? [
    { labelKey: "dashboard.presence",    v: lastAvi.presence_score != null ? Math.round(lastAvi.presence_score) : null },
    { labelKey: "dashboard.position",    v: lastAvi.rank_score != null ? Math.round(lastAvi.rank_score) : null },
    { labelKey: "dashboard.sentiment",   v: lastAvi.sentiment_score != null ? Math.round(lastAvi.sentiment_score) : null },
    { labelKey: "dashboard.reliability", v: lastAvi.stability_score != null ? Math.round(lastAvi.stability_score) : null },
  ] : undefined;

  // Extract unique models
  const allModelsList = Array.from(modelsSet);

  // Build trend data with real dates (null-safe)
  const trendData = aviList.map((a: any, i: number) => {
    const dateStr = a.computed_at
      ? new Date(a.computed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
      : `v${i + 1}`;
    return {
      run: dateStr,
      avi: a.avi_score != null ? Math.round(a.avi_score * 10) / 10 : null,
      prominence: a.presence_score != null ? Math.round(a.presence_score) : null,
      sentiment: a.sentiment_score != null ? Math.round(a.sentiment_score) : null,
      computed_at: a.computed_at,
    };
  });

  // Build recent runs
  const aviMap = new Map(aviList.map((a: any) => [a.run_id, a.avi_score]));
  const recentRuns = runs.slice(0, 5).map((r: any) => ({
    id: r.id,
    project_id: r.project_id,
    project_name: projectMap.get(r.project_id)?.name ?? "\u2014",
    version: r.version,
    status: r.status,
    avi_score: aviMap.get(r.id) ?? null,
    date: new Date(r.completed_at ?? r.created_at).toLocaleDateString("it-IT"),
  }));

  const stats = [
    { labelKey: "dashboard.promptsExecuted",    value: String(totalPrompts ?? 0),       subKey: "dashboard.inAllRuns" },
    { labelKey: "dashboard.brandMentions",       value: mentionRate,                     subKey: "dashboard.pctResponses" },
    { labelKey: "dashboard.competitorsFound",    value: String(competitorsCount ?? 0),   subKey: "dashboard.autoDiscovery" },
    { labelKey: "dashboard.sourcesExtracted",    value: String(sourcesCount ?? 0),       subKey: "dashboard.uniqueDomains" },
    { labelKey: "dashboard.aiModels",            value: String(modelsSet.size),          subKey: "dashboard.activeIntegrations" },
    { labelKey: "dashboard.analysesRun",         value: String(runs.length),            subKey: "dashboard.totalHistory" },
    ...(aiConsultedPct !== "--" ? [{ labelKey: "dashboard.aiConsultedSources", value: aiConsultedPct, subKey: "dashboard.aiConsultedSourcesDesc" }] : []),
  ];

  const competitorBarData: { name: string; avi: number }[] = (((compAviRowsRes as any).data ?? []) as any[]).map((c: any) => ({
    name: c.competitor_name,
    avi: Math.round(c.avi_score * 10) / 10,
  }));

  const proj = activeProjectId ? projectMap.get(activeProjectId) : null;
  const projectModelsConfig: string[] = (proj?.models_config as string[]) ?? ["gpt-5.4-mini"];

  return (
    <>
    <DemoBanner plan={userPlan} />
    <DashboardClient
      aviScore={aviScore}
      aviTrend={aviTrend}
      aviComponents={aviComponents}
      noBrandMentions={noBrandMentions}
      stats={stats}
      trendData={trendData}
      recentRuns={recentRuns}
      competitorBarData={competitorBarData}
      projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))}
      models={allModelsList}
      activeProjectId={activeProjectId}
      projectQueryCount={projectQueryCount}
      projectSegmentCount={projectSegmentCount}
      projectModelsConfig={projectModelsConfig}
    />
    </>
  );
}

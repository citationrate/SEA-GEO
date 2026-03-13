import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";

import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <DashboardClient aviScore={null} aviTrend={null} stats={[]} trendData={[]} recentRuns={[]} competitorBarData={[]} projects={[]} />;

  // Get all projects for this user
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

  // Get all analysis runs (exclude archived)
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
  // modelsSet.size is used in stats below

  // Filter runs by selected model
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

  // Get AVI history filtered by run
  const { data: aviHistory } = runIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("avi_score, presence_score, rank_score, sentiment_score, stability_score, computed_at, run_id")
        .in("run_id", runIds)
        .order("computed_at", { ascending: true })
    : { data: [] };

  const aviList = (aviHistory ?? []) as any[];
  const lastAvi = aviList.length > 0 ? aviList[aviList.length - 1] : null;
  const prevAvi = aviList.length > 1 ? aviList[aviList.length - 2] : null;

  const aviScore = lastAvi?.avi_score ?? null;
  const aviTrend = lastAvi && prevAvi ? lastAvi.avi_score - prevAvi.avi_score : null;
  const noBrandMentions = lastAvi != null && lastAvi.avi_score === 0 && lastAvi.presence_score === 0;

  // Get total prompts executed
  const { count: totalPrompts } = runIds.length > 0
    ? await supabase
        .from("prompts_executed")
        .select("*", { count: "exact", head: true })
        .in("run_id", runIds)
    : { count: 0 };

  // Get competitors count
  const { count: competitorsCount } = targetIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*", { count: "exact", head: true })
        .in("project_id", targetIds)
    : { count: 0 };

  // Get sources count
  const { count: sourcesCount } = targetIds.length > 0
    ? await supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .in("project_id", targetIds)
    : { count: 0 };

  // Compute brand mention rate from response_analysis
  let mentionRate = "--";
  if (runIds.length > 0) {
    const promptIdsForMention = (await supabase.from("prompts_executed").select("id").in("run_id", runIds)).data?.map((p: any) => p.id) ?? [];
    if (promptIdsForMention.length > 0) {
      const { count: totalAnalyses } = await supabase
        .from("response_analysis")
        .select("*", { count: "exact", head: true })
        .in("prompt_executed_id", promptIdsForMention);
      const { count: mentionedCount } = await supabase
        .from("response_analysis")
        .select("*", { count: "exact", head: true })
        .in("prompt_executed_id", promptIdsForMention)
        .eq("brand_mentioned", true);
      if (totalAnalyses && totalAnalyses > 0) {
        mentionRate = `${Math.round(((mentionedCount ?? 0) / totalAnalyses) * 100)}%`;
      }
    }
  }

  // Build AVI components for ring
  const aviComponents = lastAvi ? [
    { label: "Presenza",    v: lastAvi.presence_score != null ? Math.round(lastAvi.presence_score) : null },
    { label: "Posizione",   v: lastAvi.rank_score != null ? Math.round(lastAvi.rank_score) : null },
    { label: "Sentiment",   v: lastAvi.sentiment_score != null ? Math.round(lastAvi.sentiment_score) : null },
    { label: "Affidabilità", v: lastAvi.stability_score != null ? Math.round(lastAvi.stability_score) : null },
  ] : undefined;

  // Extract unique models for per-model trend lines
  const allModelsList = Array.from(modelsSet);

  // Compute per-model AVI per run for trend chart
  const perModelAviByRun = new Map<string, Record<string, number>>();
  if (allModelsList.length > 1 && runIds.length > 0) {
    for (const run of runs) {
      if (run.status !== "completed") continue;
      const { data: rp } = await supabase
        .from("prompts_executed")
        .select("id, model")
        .eq("run_id", run.id);
      const rpList = (rp ?? []) as any[];
      const rpIds = rpList.map((p: any) => p.id);
      if (rpIds.length === 0) continue;
      const { data: ra } = await supabase
        .from("response_analysis")
        .select("prompt_executed_id, brand_mentioned, brand_rank, sentiment_score")
        .in("prompt_executed_id", rpIds);
      const raList = (ra ?? []) as any[];
      const modelAvis: Record<string, number> = {};
      for (const model of (run.models_used ?? []) as string[]) {
        const mIds = new Set(rpList.filter((p: any) => p.model === model).map((p: any) => p.id));
        const mAnalyses = raList.filter((a: any) => mIds.has(a.prompt_executed_id));
        if (mAnalyses.length === 0) continue;
        const mentioned = mAnalyses.filter((a: any) => a.brand_mentioned).length;
        const presence = (mentioned / mAnalyses.length) * 100;
        const rankVals = mAnalyses.map((a: any) => (!a.brand_mentioned || !a.brand_rank || a.brand_rank <= 0) ? 0 : Math.max(0, 100 - (a.brand_rank - 1) * 20));
        const rankS = rankVals.reduce((s: number, v: number) => s + v, 0) / rankVals.length;
        const sentVals = mAnalyses.map((a: any) => (!a.brand_mentioned || a.sentiment_score == null) ? 0 : (a.sentiment_score + 1) * 50);
        const sentS = sentVals.reduce((s: number, v: number) => s + v, 0) / sentVals.length;
        modelAvis[model] = Math.round((presence * 0.40 + rankS * 0.35 + sentS * 0.25) * 10) / 10;
      }
      perModelAviByRun.set(run.id, modelAvis);
    }
  }

  // Build trend data with real dates (null-safe)
  const trendData = aviList.map((a: any, i: number) => {
    const dateStr = a.computed_at
      ? new Date(a.computed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
      : `v${i + 1}`;
    const point: any = {
      run: dateStr,
      avi: a.avi_score != null ? Math.round(a.avi_score * 10) / 10 : null,
      prominence: a.presence_score != null ? Math.round(a.presence_score) : null,
      sentiment: a.sentiment_score != null ? Math.round(a.sentiment_score) : null,
    };
    const modelAvis = perModelAviByRun.get(a.run_id);
    if (modelAvis) {
      for (const [model, score] of Object.entries(modelAvis)) {
        point[model] = score;
      }
    }
    return point;
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
    { label: "Prompt Eseguiti",    value: String(totalPrompts ?? 0),       sub: "in tutte le run" },
    { label: "Menzioni Brand",     value: mentionRate,                     sub: "% delle risposte" },
    { label: "Competitor Trovati", value: String(competitorsCount ?? 0),   sub: "discovery automatica" },
    { label: "Fonti Estratte",     value: String(sourcesCount ?? 0),       sub: "totale estratte" },
    { label: "Modelli AI",         value: String(modelsSet.size),          sub: "integrazioni usate" },
    { label: "Analisi Eseguite",   value: String(runs.length),            sub: "totale storico" },
  ];

  // Competitor bar data - only from active (non-archived) runs
  const { data: allCompetitors } = runIds.length > 0
    ? await supabase.from("competitors").select("name, mention_count").in("project_id", targetIds).in("discovered_at_run_id", runIds)
    : { data: [] };

  const compCounts = new Map<string, number>();
  (allCompetitors ?? []).forEach((c: any) => {
    const key = c.name.toLowerCase().trim();
    compCounts.set(key, (compCounts.get(key) ?? 0) + (c.mention_count ?? 1));
  });
  // Keep original casing from first occurrence
  const compNameMap = new Map<string, string>();
  (allCompetitors ?? []).forEach((c: any) => {
    const key = c.name.toLowerCase().trim();
    if (!compNameMap.has(key)) compNameMap.set(key, c.name);
  });
  const competitorBarData = Array.from(compCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ name: compNameMap.get(key) ?? key, count }));

  return (
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
    />
  );
}

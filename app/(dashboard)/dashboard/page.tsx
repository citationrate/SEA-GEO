import { createServerClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <DashboardClient aviScore={null} aviTrend={null} stats={[]} trendData={[]} recentRuns={[]} competitorBarData={[]} />;

  // Get all projects for this user
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

  // Get all analysis runs
  const { data: runs } = projectIds.length > 0
    ? await supabase
        .from("analysis_runs")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Get latest AVI (last completed analysis, not average)
  const { data: lastAviRow } = projectIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("*")
        .in("project_id", projectIds)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Get previous AVI for trend delta
  const { data: prevAviRow } = projectIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("avi_score")
        .in("project_id", projectIds)
        .order("computed_at", { ascending: false })
        .range(1, 1)
        .maybeSingle()
    : { data: null };

  // Get all AVI history for trend chart
  const { data: aviHistory } = projectIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("*")
        .in("project_id", projectIds)
        .order("computed_at", { ascending: true })
    : { data: [] };

  // Get total prompts executed
  const runIds = (runs ?? []).map((r: any) => r.id);
  const { count: totalPrompts } = runIds.length > 0
    ? await supabase
        .from("prompts_executed")
        .select("*", { count: "exact", head: true })
        .in("run_id", runIds)
    : { count: 0 };

  // Get competitors count
  const { count: competitorsCount } = projectIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*", { count: "exact", head: true })
        .in("project_id", projectIds)
    : { count: 0 };

  // Get sources count
  const { count: sourcesCount } = runIds.length > 0
    ? await supabase
        .from("sources")
        .select("*", { count: "exact", head: true })
        .in("prompt_executed_id",
          (await supabase.from("prompts_executed").select("id").in("run_id", runIds)).data?.map((p: any) => p.id) ?? ["__none__"]
        )
    : { count: 0 };

  // Compute stats
  const lastAvi = lastAviRow as any;
  const aviScore = lastAvi?.avi_score ?? null;
  const aviTrend = lastAvi && prevAviRow ? lastAvi.avi_score - (prevAviRow as any).avi_score : null;

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
    { label: "Presence",  v: lastAvi.presence_score },
    { label: "Rank",      v: lastAvi.rank_score },
    { label: "Sentiment", v: lastAvi.sentiment_score },
    { label: "Stability", v: lastAvi.stability_score },
  ] : undefined;

  // Build trend data
  const trendData = (aviHistory ?? []).map((a: any, i: number) => ({
    run: `v${i + 1}`,
    avi: Math.round(a.avi_score),
    presence: Math.round(a.presence_score),
    sentiment: Math.round(a.sentiment_score),
  }));

  // Build recent runs
  const aviMap = new Map((aviHistory ?? []).map((a: any) => [a.run_id, a.avi_score]));
  const recentRuns = (runs ?? []).slice(0, 5).map((r: any) => ({
    id: r.id,
    project_id: r.project_id,
    project_name: projectMap.get(r.project_id)?.name ?? "—",
    version: r.version,
    status: r.status,
    avi_score: aviMap.get(r.id) ?? null,
    date: new Date(r.completed_at ?? r.created_at).toLocaleDateString("it-IT"),
  }));

  // Get unique models used
  const modelsSet = new Set<string>();
  (runs ?? []).forEach((r: any) => {
    (r.models_used ?? []).forEach((m: string) => modelsSet.add(m));
  });

  const stats = [
    { label: "Prompt Eseguiti",    value: String(totalPrompts ?? 0),       sub: "in tutte le run" },
    { label: "Menzioni Brand",     value: mentionRate,                     sub: "% delle risposte" },
    { label: "Competitor Trovati", value: String(competitorsCount ?? 0),   sub: "discovery automatica" },
    { label: "Fonti Estratte",     value: String(sourcesCount ?? 0),       sub: "totale estratte" },
    { label: "Modelli AI",         value: String(modelsSet.size),          sub: "integrazioni usate" },
    { label: "Analisi Eseguite",   value: String((runs ?? []).length),     sub: "totale storico" },
  ];

  // Competitor bar data - count mentions per competitor
  const { data: allCompetitors } = projectIds.length > 0
    ? await supabase.from("competitors").select("name").in("project_id", projectIds)
    : { data: [] };

  const compCounts = new Map<string, number>();
  (allCompetitors ?? []).forEach((c: any) => {
    compCounts.set(c.name, (compCounts.get(c.name) ?? 0) + 1);
  });
  const competitorBarData = Array.from(compCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  return (
    <DashboardClient
      aviScore={aviScore}
      aviTrend={aviTrend}
      aviComponents={aviComponents}
      stats={stats}
      trendData={trendData}
      recentRuns={recentRuns}
      competitorBarData={competitorBarData}
    />
  );
}

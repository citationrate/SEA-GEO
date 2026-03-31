import { createServiceClient } from "@/lib/supabase/service";
import { AdminOverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const svc = createServiceClient();

  // KPI queries
  const [
    { count: totalUsers },
    { count: activeProjects },
    { count: completedAnalyses },
    { count: weekAnalyses },
    { count: proUsers },
    { count: completedComparisons },
  ] = await Promise.all([
    svc.from("profiles").select("*", { count: "exact", head: true }),
    svc.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null),
    svc.from("analysis_runs").select("*", { count: "exact", head: true }).eq("status", "completed"),
    svc.from("analysis_runs").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    svc.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    (svc.from("competitive_analyses") as any).select("*", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  // Average AVI
  const { data: aviRows } = await svc.from("avi_history").select("avi_score").order("computed_at", { ascending: false }).limit(200);
  const avgAvi = aviRows && aviRows.length > 0
    ? Math.round((aviRows.reduce((s: number, r: any) => s + Number(r.avi_score), 0) / aviRows.length) * 10) / 10
    : null;

  // Distinct competitors
  const { data: compRows } = await (svc.from("competitor_mentions") as any).select("competitor_name").limit(5000);
  const distinctCompetitors = new Set((compRows ?? []).map((r: any) => (r.competitor_name as string).toLowerCase().trim())).size;

  // Analyses per day last 30d
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: recentRuns } = await svc.from("analysis_runs").select("created_at").gte("created_at", thirtyDaysAgo);
  const dayMap = new Map<string, number>();
  for (const r of (recentRuns ?? []) as any[]) {
    const day = new Date(r.created_at).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const analysesPerDay = Array.from(dayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Plan distribution
  const { data: allProfiles } = await svc.from("profiles").select("plan");
  const planCounts: Record<string, number> = {};
  for (const p of (allProfiles ?? []) as any[]) {
    const plan = p.plan || "demo";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

  // Top sectors
  const { data: allProjects } = await svc.from("projects").select("sector").is("deleted_at", null);
  const sectorCounts: Record<string, number> = {};
  for (const p of (allProjects ?? []) as any[]) {
    const sec = p.sector || "Non specificato";
    sectorCounts[sec] = (sectorCounts[sec] ?? 0) + 1;
  }
  const topSectors = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent activity
  const { data: recentActivity } = await svc
    .from("analysis_runs")
    .select("id, status, created_at, project_id, models_used")
    .order("created_at", { ascending: false })
    .limit(10);

  // Enrich with project names and user emails
  const actProjectIds = Array.from(new Set((recentActivity ?? []).map((r: any) => r.project_id)));
  const { data: actProjects } = actProjectIds.length > 0
    ? await svc.from("projects").select("id, name, user_id").in("id", actProjectIds)
    : { data: [] };
  const projMap = new Map((actProjects ?? []).map((p: any) => [p.id, p]));
  const userIds = Array.from(new Set((actProjects ?? []).map((p: any) => p.user_id)));
  const { data: actUsers } = userIds.length > 0
    ? await svc.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const userMap = new Map((actUsers ?? []).map((u: any) => [u.id, u]));

  const activity = (recentActivity ?? []).map((r: any) => {
    const proj = projMap.get(r.project_id);
    const usr = proj ? userMap.get(proj.user_id) : null;
    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      project_name: proj?.name ?? "—",
      user_email: usr?.email ?? "—",
      models: r.models_used ?? [],
    };
  });

  return (
    <AdminOverviewClient
      kpi={{
        totalUsers: totalUsers ?? 0,
        activeProjects: activeProjects ?? 0,
        completedAnalyses: completedAnalyses ?? 0,
        avgAvi,
        weekAnalyses: weekAnalyses ?? 0,
        proUsers: proUsers ?? 0,
        completedComparisons: completedComparisons ?? 0,
        distinctCompetitors,
      }}
      analysesPerDay={analysesPerDay}
      planDistribution={planDistribution}
      topSectors={topSectors}
      activity={activity}
    />
  );
}

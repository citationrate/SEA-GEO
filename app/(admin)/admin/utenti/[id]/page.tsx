import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { UserDetailClient } from "./user-detail-client";

export const metadata = { title: "Dettaglio Utente" };

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const svc = createServiceClient();

  const { data: profile } = await svc.from("profiles").select("*").eq("id", params.id).single();
  if (!profile) notFound();
  const p = profile as any;

  // Projects
  const { data: projects } = await svc.from("projects").select("*").eq("user_id", params.id).is("deleted_at", null).order("created_at", { ascending: false });
  const projectIds = (projects ?? []).map((pr: any) => pr.id);

  // Runs per project
  const { data: runs } = projectIds.length > 0
    ? await svc.from("analysis_runs").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
    : { data: [] };

  // AVI per run
  const runIds = (runs ?? []).map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0
    ? await svc.from("avi_history").select("run_id, avi_score, computed_at, project_id").in("run_id", runIds).order("computed_at", { ascending: true })
    : { data: [] };

  const aviMap = new Map((aviRows ?? []).map((a: any) => [a.run_id, a.avi_score]));

  // Competitive analyses
  const { count: comparisons } = projectIds.length > 0
    ? await (svc.from("competitive_analyses") as any).select("*", { count: "exact", head: true }).in("project_id", projectIds)
    : { count: 0 };

  // Models used
  const { data: promptModels } = runIds.length > 0
    ? await svc.from("prompts_executed").select("model").in("run_id", runIds)
    : { data: [] };
  const modelCounts: Record<string, number> = {};
  for (const pm of (promptModels ?? []) as any[]) {
    modelCounts[pm.model] = (modelCounts[pm.model] ?? 0) + 1;
  }

  // AVI trend data
  const aviTrend = (aviRows ?? []).map((a: any) => ({
    date: new Date(a.computed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    avi: Math.round(Number(a.avi_score) * 10) / 10,
    project_id: a.project_id,
  }));

  const avgAvi = (aviRows ?? []).length > 0
    ? Math.round((aviRows ?? []).reduce((s: number, a: any) => s + Number(a.avi_score), 0) / (aviRows ?? []).length * 10) / 10
    : null;

  return (
    <UserDetailClient
      user={{
        id: p.id,
        email: p.email ?? "",
        full_name: p.full_name ?? "",
        plan: p.plan ?? "free",
        created_at: p.created_at,
        is_admin: p.is_admin ?? false,
      }}
      projects={(projects ?? []).map((pr: any) => ({
        id: pr.id,
        name: pr.name,
        target_brand: pr.target_brand,
        sector: pr.sector,
        created_at: pr.created_at,
        runCount: (runs ?? []).filter((r: any) => r.project_id === pr.id).length,
        lastRun: (runs ?? []).find((r: any) => r.project_id === pr.id)?.created_at ?? null,
      }))}
      runs={(runs ?? []).map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        status: r.status,
        version: r.version,
        models_used: r.models_used ?? [],
        created_at: r.created_at,
        avi_score: aviMap.has(r.id) ? Math.round(Number(aviMap.get(r.id)) * 10) / 10 : null,
      }))}
      stats={{
        totalProjects: (projects ?? []).length,
        totalRuns: (runs ?? []).length,
        avgAvi,
        comparisons: comparisons ?? 0,
      }}
      modelCounts={Object.entries(modelCounts).map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count)}
      aviTrend={aviTrend}
    />
  );
}

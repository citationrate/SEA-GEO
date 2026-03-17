import { createServiceClient } from "@/lib/supabase/service";
import { ProjectsAdminClient } from "./projects-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progetti" };

export default async function AdminProjectsPage() {
  const svc = createServiceClient();

  const { data: projects } = await svc.from("projects").select("*").order("created_at", { ascending: false });
  const userIds = Array.from(new Set((projects ?? []).map((p: any) => p.user_id)));
  const { data: profiles } = userIds.length > 0 ? await svc.from("profiles").select("id, email").in("id", userIds) : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const { data: runs } = projectIds.length > 0 ? await svc.from("analysis_runs").select("id, project_id").in("project_id", projectIds) : { data: [] };
  const runCountMap = new Map<string, number>();
  for (const r of (runs ?? []) as any[]) { runCountMap.set(r.project_id, (runCountMap.get(r.project_id) ?? 0) + 1); }

  const runIds = (runs ?? []).map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0 ? await svc.from("avi_history").select("run_id, avi_score, project_id").order("computed_at", { ascending: false }) .in("run_id", runIds) : { data: [] };
  const aviMap = new Map<string, number>();
  for (const a of (aviRows ?? []) as any[]) { if (!aviMap.has(a.project_id)) aviMap.set(a.project_id, Math.round(Number(a.avi_score) * 10) / 10); }

  const rows = (projects ?? []).map((p: any) => ({
    id: p.id, name: p.name, target_brand: p.target_brand,
    user_email: emailMap.get(p.user_id) ?? "—",
    sector: p.sector, country: p.country,
    runs: runCountMap.get(p.id) ?? 0,
    avi_score: aviMap.get(p.id) ?? null,
    created_at: p.created_at,
    deleted: !!p.deleted_at,
  }));

  return <ProjectsAdminClient rows={rows} />;
}

import { createServiceClient } from "@/lib/supabase/service";
import { AnalysisAdminClient } from "./analysis-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analisi Runs" };

export default async function AdminAnalysisPage() {
  const svc = createServiceClient();

  const { data: runs } = await svc.from("analysis_runs").select("*").order("created_at", { ascending: false }).limit(100);
  const projectIds = Array.from(new Set((runs ?? []).map((r: any) => r.project_id)));
  const { data: projects } = projectIds.length > 0 ? await svc.from("projects").select("id, name, user_id").in("id", projectIds) : { data: [] };
  const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
  const userIds = Array.from(new Set((projects ?? []).map((p: any) => p.user_id)));
  const { data: profiles } = userIds.length > 0 ? await svc.from("profiles").select("id, email").in("id", userIds) : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));

  const runIds = (runs ?? []).map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0 ? await svc.from("avi_history").select("run_id, avi_score").in("run_id", runIds) : { data: [] };
  const aviMap = new Map((aviRows ?? []).map((a: any) => [a.run_id, Math.round(Number(a.avi_score) * 10) / 10]));

  const rows = (runs ?? []).map((r: any) => {
    const proj = projMap.get(r.project_id);
    return {
      id: r.id, status: r.status, version: r.version,
      project_name: proj?.name ?? "—",
      user_email: proj ? (emailMap.get(proj.user_id) ?? "—") : "—",
      models_used: r.models_used ?? [],
      completed_prompts: r.completed_prompts ?? 0,
      total_prompts: r.total_prompts ?? 0,
      avi_score: aviMap.get(r.id) ?? null,
      created_at: r.created_at,
    };
  });

  return <AnalysisAdminClient rows={rows} />;
}

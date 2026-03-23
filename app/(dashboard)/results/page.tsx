import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResultsTable } from "./results-table";
import { ResultsHeader, ResultsEmpty } from "./results-header";

export const metadata = { title: "Risultati" };

export default async function ResultsPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createDataClient();

  // Get user's projects first, then filter runs by those projects
  const { data: userProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const userProjectIds = (userProjects ?? []).map((p: any) => p.id);

  const { data: runs } = userProjectIds.length > 0
    ? await supabase
        .from("analysis_runs")
        .select("*")
        .in("project_id", userProjectIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const projectIds = Array.from(new Set((runs ?? []).map((r: any) => r.project_id)));
  const { data: projects } = projectIds.length > 0
    ? await supabase.from("projects").select("id, name, target_brand").in("id", projectIds)
    : { data: [] };

  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

  const runIds = (runs ?? []).map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0
    ? await supabase.from("avi_history").select("run_id, avi_score").in("run_id", runIds)
    : { data: [] };

  const aviMap = new Map((aviRows ?? []).map((a: any) => [a.run_id, a.avi_score]));

  const rows = (runs ?? []).map((r: any) => {
    const proj = projectMap.get(r.project_id);
    return {
      id: r.id,
      project_id: r.project_id,
      version: r.version,
      models_used: r.models_used ?? [],
      completed_prompts: r.completed_prompts,
      total_prompts: r.total_prompts,
      status: r.status,
      completed_at: r.completed_at,
      created_at: r.created_at,
      projectName: proj?.name ?? "—",
      projectBrand: proj?.target_brand ?? "",
      aviScore: aviMap.get(r.id) ?? null,
    };
  });

  return (
    <div data-tour="results-page" className="space-y-6 max-w-[1400px] animate-fade-in">
      <ResultsHeader />

      {!(runs ?? []).length ? (
        <ResultsEmpty />
      ) : (
        <ResultsTable rows={rows} />
      )}
    </div>
  );
}

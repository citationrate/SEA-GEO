import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { GitCompare } from "lucide-react";

export const metadata = { title: "Confronto" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);
  const targetIds = selectedId ? [selectedId] : projectIds;

  // Fetch completed runs
  const { data: runs } = targetIds.length > 0
    ? await supabase
        .from("analysis_runs")
        .select("id, project_id, version, status, completed_at")
        .in("project_id", targetIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
    : { data: [] };

  const runList = (runs ?? []) as any[];

  // Fetch AVI for all runs
  const runIds = runList.map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("run_id, avi_score, presence_score, rank_score, sentiment_score, stability_score")
        .in("run_id", runIds)
    : { data: [] };

  const aviMap = new Map((aviRows ?? []).map((a: any) => [a.run_id, a]));
  const projectMap = new Map(projectsList.map((p: any) => [p.id, p.name]));

  const enrichedRuns = runList.map((r: any) => ({
    ...r,
    projectName: projectMap.get(r.project_id) ?? "-",
    avi: aviMap.get(r.id) ?? null,
  }));

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GitCompare className="w-6 h-6 text-accent" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Confronto</h1>
            <p className="text-sm text-muted-foreground">Confronta i risultati tra run diverse</p>
          </div>
        </div>
        <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
      </div>

      {enrichedRuns.length < 2 ? (
        <div className="card p-12 text-center">
          <GitCompare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Servono almeno 2 analisi completate per confrontare i risultati.</p>
        </div>
      ) : (
        <>
          {/* Run comparison table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Run</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Progetto</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">AVI</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Presence</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Rank</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Sentiment</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Stability</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Data</th>
                </tr>
              </thead>
              <tbody>
                {enrichedRuns.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-foreground">v{r.version}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.projectName}</td>
                    <td className="px-4 py-3 text-right font-display font-bold text-primary">
                      {r.avi ? Math.round(r.avi.avi_score * 10) / 10 : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {r.avi?.presence_score != null ? `${Math.round(r.avi.presence_score * 100) / 100}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {r.avi?.rank_score != null ? `${Math.round(r.avi.rank_score * 100) / 100}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {r.avi?.sentiment_score != null ? `${Math.round(r.avi.sentiment_score * 100) / 100}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {r.avi?.stability_score != null ? `${Math.round(r.avi.stability_score * 100) / 100}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.completed_at ? new Date(r.completed_at).toLocaleDateString("it-IT") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Coming soon */}
          <div className="card p-8 text-center border border-dashed border-border/50">
            <p className="text-muted-foreground text-sm">
              Confronto dettagliato side-by-side tra due run in arrivo.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

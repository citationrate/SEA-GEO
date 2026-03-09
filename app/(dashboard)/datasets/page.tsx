import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { Database } from "lucide-react";

export const metadata = { title: "Dataset" };

export default async function DatasetsPage({
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

  // Fetch queries for selected project(s)
  const { data: queries } = targetIds.length > 0
    ? await supabase
        .from("queries")
        .select("id, text, funnel_stage, project_id, created_at")
        .in("project_id", targetIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const queryList = (queries ?? []) as any[];
  const projectMap = new Map(projectsList.map((p: any) => [p.id, p.name]));

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-accent" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Dataset</h1>
            <p className="text-sm text-muted-foreground">Query salvate per progetto</p>
          </div>
        </div>
        <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
      </div>

      {queryList.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessuna query trovata. Crea un progetto e aggiungi delle query.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Query</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Funnel</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">Progetto</th>
              </tr>
            </thead>
            <tbody>
              {queryList.map((q: any) => (
                <tr key={q.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-foreground">{q.text}</td>
                  <td className="px-4 py-3">
                    {q.funnel_stage ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        q.funnel_stage === "tofu" ? "bg-blue-500/20 text-blue-400" :
                        q.funnel_stage === "mofu" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>
                        {q.funnel_stage.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{projectMap.get(q.project_id) ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coming soon */}
      <div className="card p-8 text-center border border-dashed border-border/50">
        <p className="text-muted-foreground text-sm">
          Modifica e gestione avanzata dei dataset in arrivo.
        </p>
      </div>
    </div>
  );
}

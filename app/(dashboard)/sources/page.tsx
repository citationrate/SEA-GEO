import { createServerClient } from "@/lib/supabase/server";
import { Globe, ExternalLink, Filter } from "lucide-react";

export const metadata = { title: "Fonti" };

export default async function SourcesPage({ searchParams }: { searchParams: { brand_owned?: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id);

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p.name]));

  // Get all runs → prompts → sources
  const { data: runs } = projectIds.length > 0
    ? await supabase.from("analysis_runs").select("id, project_id").in("project_id", projectIds)
    : { data: [] };

  const runMap = new Map((runs ?? []).map((r: any) => [r.id, r.project_id]));
  const runIds = (runs ?? []).map((r: any) => r.id);

  const { data: prompts } = runIds.length > 0
    ? await supabase.from("prompts_executed").select("id, run_id").in("run_id", runIds)
    : { data: [] };

  const promptRunMap = new Map((prompts ?? []).map((p: any) => [p.id, p.run_id]));
  const promptIds = (prompts ?? []).map((p: any) => p.id);

  let sourcesQuery = supabase
    .from("sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (promptIds.length > 0) {
    sourcesQuery = sourcesQuery.in("prompt_executed_id", promptIds);
  } else {
    sourcesQuery = sourcesQuery.in("prompt_executed_id", ["__none__"]);
  }

  const filterBrandOwned = searchParams.brand_owned;
  if (filterBrandOwned === "true") {
    sourcesQuery = sourcesQuery.eq("brand_owned", true);
  } else if (filterBrandOwned === "false") {
    sourcesQuery = sourcesQuery.eq("brand_owned", false);
  }

  const { data: sources } = await sourcesQuery;
  const sourcesList = (sources ?? []) as any[];

  // Helper to get project name from source
  function getProjectName(promptExecutedId: string): string {
    const runId = promptRunMap.get(promptExecutedId);
    if (!runId) return "—";
    const projectId = runMap.get(runId);
    if (!projectId) return "—";
    return projectMap.get(projectId) ?? "—";
  }

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Fonti</h1>
            <p className="text-sm text-muted-foreground">URL e domini estratti dalle risposte AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <a
            href="/sources"
            className={`badge ${!filterBrandOwned ? "badge-primary" : "badge-muted"} text-xs`}
          >
            Tutte
          </a>
          <a
            href="/sources?brand_owned=true"
            className={`badge ${filterBrandOwned === "true" ? "badge-primary" : "badge-muted"} text-xs`}
          >
            Brand Owned
          </a>
          <a
            href="/sources?brand_owned=false"
            className={`badge ${filterBrandOwned === "false" ? "badge-primary" : "badge-muted"} text-xs`}
          >
            Non Owned
          </a>
        </div>
      </div>

      {sourcesList.length === 0 ? (
        <div className="card p-12 text-center">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessuna fonte trovata.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Dominio</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">URL</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Progetto</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Brand Owned</th>
                </tr>
              </thead>
              <tbody>
                {sourcesList.map((s: any) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{s.domain ?? "—"}</td>
                    <td className="py-3 px-4">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:text-primary/70 transition-colors truncate max-w-[350px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.url}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{getProjectName(s.prompt_executed_id)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="badge badge-muted text-[10px]">{s.source_type}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.brand_owned ? (
                        <span className="badge badge-success text-[10px]">Sì</span>
                      ) : (
                        <span className="badge badge-muted text-[10px]">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {sourcesList.length} fonti trovate
          </div>
        </div>
      )}
    </div>
  );
}

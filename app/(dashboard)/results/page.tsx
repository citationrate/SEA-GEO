import { createServerClient } from "@/lib/supabase/server";
import { BarChart3, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export const metadata = { title: "Risultati" };

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  running: "In corso",
  completed: "Completata",
  failed: "Fallita",
  cancelled: "Annullata",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-muted",
  running: "badge-primary",
  completed: "badge-success",
  failed: "badge-muted text-destructive border-destructive/20 bg-destructive/10",
  cancelled: "badge-muted",
};

export default async function ResultsPage() {
  const supabase = createServerClient();

  const { data: runs } = await supabase
    .from("analysis_runs")
    .select("*")
    .order("created_at", { ascending: false });

  // Get project info for each run
  const projectIds = Array.from(new Set((runs ?? []).map((r: any) => r.project_id)));
  const { data: projects } = projectIds.length > 0
    ? await supabase.from("projects").select("id, name, target_brand").in("id", projectIds)
    : { data: [] };

  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

  // Get AVI scores
  const runIds = (runs ?? []).map((r: any) => r.id);
  const { data: aviRows } = runIds.length > 0
    ? await supabase.from("avi_history").select("run_id, avi_score").in("run_id", runIds)
    : { data: [] };

  const aviMap = new Map((aviRows ?? []).map((a: any) => [a.run_id, a.avi_score]));

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Risultati</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tutte le analisi eseguite</p>
      </div>

      {!(runs ?? []).length ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nessuna analisi eseguita.</p>
          <a href="/projects" className="text-sm text-primary hover:text-primary/70 transition-colors mt-2">
            Vai ai progetti →
          </a>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-3 px-4 font-medium">Progetto</th>
                <th className="text-left py-3 px-4 font-medium">Versione</th>
                <th className="text-left py-3 px-4 font-medium">Modelli</th>
                <th className="text-left py-3 px-4 font-medium">Prompt</th>
                <th className="text-left py-3 px-4 font-medium">AVI</th>
                <th className="text-left py-3 px-4 font-medium">Stato</th>
                <th className="text-left py-3 px-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((r: any) => {
                const proj = projectMap.get(r.project_id);
                const aviScore = aviMap.get(r.id);
                const Icon = STATUS_ICON[r.status] ?? Clock;
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <a href={`/projects/${r.project_id}/runs/${r.id}`} className="hover:text-primary transition-colors">
                        <p className="font-medium text-foreground">{proj?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{proj?.target_brand ?? ""}</p>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">v{r.version}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {r.models_used?.map((m: string) => (
                          <span key={m} className="badge badge-muted text-[10px]">{m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{r.completed_prompts}/{r.total_prompts}</td>
                    <td className="py-3 px-4">
                      {aviScore != null ? (
                        <span className="font-display font-bold text-primary">{aviScore}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-muted"} flex items-center gap-1 w-fit`}>
                        <Icon className={`w-3 h-3 ${r.status === "running" ? "animate-spin" : ""}`} />
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(r.completed_at ?? r.created_at).toLocaleString("it-IT")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

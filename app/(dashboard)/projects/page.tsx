import { createServerClient } from "@/lib/supabase/server";
import { Plus, FolderOpen } from "lucide-react";

export const metadata = { title: "Progetti" };

export default async function ProjectsPage() {
  const supabase = createServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*, analysis_runs(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Progetti</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestisci i tuoi brand e le configurazioni di analisi</p>
        </div>
        <a
          href="/projects/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuovo Progetto
        </a>
      </div>

      {!projects?.length ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nessun progetto ancora.</p>
          <a href="/projects/new" className="text-sm text-primary hover:text-primary/70 transition-colors mt-2">
            Crea il primo progetto →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <a key={p.id} href={`/projects/${p.id}`}
              className="card p-5 hover:border-primary/30 hover:bg-surface-2 transition-all duration-150 block group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{p.target_brand[0].toUpperCase()}</span>
                </div>
                <span className="badge-muted text-[10px]">{p.language.toUpperCase()}</span>
              </div>
              <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{p.target_brand}</p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{(p.analysis_runs as unknown as { count: number }[])?.[0]?.count ?? 0} analisi</span>
                <span>·</span>
                <span>{new Date(p.created_at).toLocaleDateString("it-IT")}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

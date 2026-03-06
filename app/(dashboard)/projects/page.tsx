import { createServerClient } from "@/lib/supabase/server";
import { Plus, FolderOpen } from "lucide-react";

export const metadata = { title: "Progetti" };

export default async function ProjectsPage() {
  const supabase = createServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand, language, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Progetti</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestisci i tuoi brand</p>
        </div>
        <a href="/projects/new" className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" />
          Nuovo Progetto
        </a>
      </div>
      {!projects?.length ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nessun progetto ancora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p: { id: string; name: string; target_brand: string; language: string; created_at: string }) => (
            <a key={p.id} href={`/projects/${p.id}`} className="card p-5 block">
              <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{p.target_brand}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

import { createServerClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { ProjectsList } from "./projects-list";

export const metadata = { title: "Progetti" };

export default async function ProjectsPage() {
  const supabase = createServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand, language, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const items = (projects ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    target_brand: p.target_brand,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Progetti</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestisci i tuoi brand</p>
        </div>
        <a href="/projects/new" data-tour="new-project-btn" className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px]">
          <Plus className="w-4 h-4" />
          Nuovo Progetto
        </a>
      </div>
      <ProjectsList projects={items} />
    </div>
  );
}

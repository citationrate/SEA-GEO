import { createServerClient } from "@/lib/supabase/server";
import { ProjectsList } from "./projects-list";
import { ProjectsHeader } from "./projects-header";

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
      <ProjectsHeader />
      <ProjectsList projects={items} />
    </div>
  );
}

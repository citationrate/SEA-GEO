import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectsList } from "./projects-list";
import { ProjectsHeader } from "./projects-header";
import { MetaPageTrack } from "@/components/meta-page-track";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Progetti" };

export default async function ProjectsPage() {
  const auth = createServerClient();
  // Cookie-only auth — middleware already gates this route.
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const supabase = createDataClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand, language, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const items = (projects ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    target_brand: p.target_brand,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <MetaPageTrack variant="projects" />
      <ProjectsHeader />
      <ProjectsList projects={items} />
    </div>
  );
}

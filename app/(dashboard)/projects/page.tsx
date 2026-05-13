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
  // SECURITY: getUser() validates the JWT with Supabase Auth; getSession() reads only
  // the cookie and can return a stale identity (cross-account contamination from
  // chunked-cookie remnants after Suite->AVI handoff).
  const { data: { user } } = await auth.auth.getUser();
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
      <ProjectsHeader hasProjects={items.length > 0} />
      <ProjectsList projects={items} />
    </div>
  );
}

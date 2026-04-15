import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isProUser, isDemoUser } from "@/lib/utils/is-pro";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { ComparePaywall, CompareList } from "./compare-content";

export const metadata = { title: "Confronto Competitivo" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { upgrade?: string; projectId?: string };
}) {
  const auth = createServerClient();
  // Cookie-only auth — middleware already gates this route.
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const supabase = createDataClient();
  // Profile + projects can fan out — neither depends on the other. The
  // paywall check below short-circuits if the profile says non-Pro,
  // discarding the projects result; that's fine — the work was overlapped
  // with the network round-trip anyway.
  const [profileRes, projectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null),
  ]);
  const profile = (profileRes as any).data;
  const projects = (projectsRes as any).data;

  const isPro = isProUser(profile as any);

  // Paywall for non-Pro users
  if (!isPro) {
    return <ComparePaywall />;
  }

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  // Fetch competitive analyses (filtered by project if selected)
  const targetIds = selectedId ? [selectedId] : projectIds;
  const { data: analyses } = targetIds.length > 0
    ? await (supabase.from("competitive_analyses") as any)
        .select("*")
        .in("project_id", targetIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const list = (analyses ?? []) as any[];

  return (
    <CompareList
      list={list}
      projectsList={projectsList.map((p: any) => ({ id: p.id, name: p.name }))}
    />
  );
}

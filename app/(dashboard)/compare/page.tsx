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
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createDataClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = isProUser(profile as any);

  // Paywall for non-Pro users
  if (!isPro) {
    return <ComparePaywall />;
  }

  // Fetch all projects for reference
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null);

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

import { createServiceClient } from "@/lib/supabase/service";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utenti" };

export default async function AdminUsersPage() {
  const svc = createServiceClient();

  const { data: profiles } = await svc.from("profiles").select("*").order("created_at", { ascending: false });
  const userIds = (profiles ?? []).map((p: any) => p.id);

  // Count projects per user
  const { data: projects } = userIds.length > 0
    ? await svc.from("projects").select("id, user_id").is("deleted_at", null).in("user_id", userIds)
    : { data: [] };
  const projCountMap = new Map<string, number>();
  for (const p of (projects ?? []) as any[]) {
    projCountMap.set(p.user_id, (projCountMap.get(p.user_id) ?? 0) + 1);
  }

  // Count runs per user (via project)
  const projectUserMap = new Map((projects ?? []).map((p: any) => [p.id, p.user_id]));
  const projectIds = (projects ?? []).map((p: any) => p.id);
  const { data: runs } = projectIds.length > 0
    ? await svc.from("analysis_runs").select("id, project_id").in("project_id", projectIds)
    : { data: [] };
  const runCountMap = new Map<string, number>();
  for (const r of (runs ?? []) as any[]) {
    const uid = projectUserMap.get(r.project_id);
    if (uid) runCountMap.set(uid, (runCountMap.get(uid) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((p: any) => ({
    id: p.id,
    email: p.email ?? "",
    full_name: p.full_name ?? "",
    plan: p.plan ?? "demo",
    projects: projCountMap.get(p.id) ?? 0,
    analyses: runCountMap.get(p.id) ?? 0,
    updated_at: p.updated_at,
    created_at: p.created_at,
  }));

  return <UsersClient users={users} />;
}

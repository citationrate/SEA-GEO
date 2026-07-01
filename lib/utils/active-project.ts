import { cookies } from "next/headers";

// Persistent source of truth for the "active project" the user is working on.
// Written client-side (non-HttpOnly) whenever a URL carries ?projectId= (see
// components/layout/active-project-sync.tsx) and read here server-side, so
// navigating via the sidebar — which drops the query param — keeps the user on
// the SAME project instead of silently jumping to another brand's last
// analysis. Keep this string in sync with ActiveProjectSync and the logout
// cleanup in components/layout/sidebar.tsx.
export const ACTIVE_PROJECT_COOKIE = "avi_active_project";

/**
 * Resolve the active project server-side, with a persistent anchor.
 * Priority:
 *   1. explicit ?projectId= (valid)              → pin it
 *   2. persisted cookie (valid)                  → last project actually used
 *   3. defaultId (e.g. last COMPLETED analysis)  → only at fresh login
 *   4. newest project
 *
 * This supersedes the older resolveProjectId(): the cookie is what stops the
 * "project overlap" bug where a freshly-created project (no completed runs
 * yet) got overridden by defaultId = another brand's last completed analysis.
 */
export function getActiveProjectId(
  searchParams: { projectId?: string },
  projectIds: string[],
  defaultId?: string | null,
): string | null {
  if (searchParams.projectId && projectIds.includes(searchParams.projectId)) {
    return searchParams.projectId;
  }
  const persisted = cookies().get(ACTIVE_PROJECT_COOKIE)?.value;
  if (persisted && projectIds.includes(persisted)) {
    return persisted;
  }
  if (defaultId && projectIds.includes(defaultId)) {
    return defaultId;
  }
  return projectIds[0] ?? null;
}

/**
 * Project holding the user's most recently COMPLETED analysis. Used as the
 * `defaultId` fallback so a fresh login (no cookie yet) lands on real data
 * instead of the newest-created (often empty) project. Cheap indexed lookup.
 */
export async function getLastCompletedProjectId(
  supabase: any,
  projectIds: string[],
): Promise<string | null> {
  if (!projectIds || projectIds.length === 0) return null;
  const { data } = await supabase
    .from("analysis_runs")
    .select("project_id")
    .in("project_id", projectIds)
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any)?.project_id ?? null;
}

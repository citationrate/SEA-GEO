/**
 * Resolve projectId server-side: use searchParam, fallback to first project.
 * This is a pure server-safe function — no "use client".
 */
export function resolveProjectId(
  searchParams: { projectId?: string },
  projectIds: string[],
): string | null {
  if (searchParams.projectId && projectIds.includes(searchParams.projectId)) {
    return searchParams.projectId;
  }
  return projectIds[0] ?? null;
}

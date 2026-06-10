/**
 * Resolve projectId server-side.
 * Priority: explicit searchParam > caller-provided default > first project.
 *
 * `defaultId` lets a page pass a smarter fallback than "newest project" —
 * e.g. the project holding the user's last COMPLETED analysis, so a fresh
 * login lands on real data instead of an empty just-created project.
 * This is a pure server-safe function — no "use client".
 */
export function resolveProjectId(
  searchParams: { projectId?: string },
  projectIds: string[],
  defaultId?: string | null,
): string | null {
  if (searchParams.projectId && projectIds.includes(searchParams.projectId)) {
    return searchParams.projectId;
  }
  if (defaultId && projectIds.includes(defaultId)) {
    return defaultId;
  }
  return projectIds[0] ?? null;
}

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";

const LS_KEY = "selectedProjectId";

interface Project {
  id: string;
  name: string;
}

export function ProjectSelector({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("projectId");

  const [selected, setSelected] = useState<string>("");

  // On mount: resolve initial selection from URL > localStorage > first project
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    const initial = paramId
      ?? (stored && projects.some((p) => p.id === stored) ? stored : null)
      ?? projects[0]?.id
      ?? "";
    if (initial && initial !== paramId) {
      // Sync URL without full navigation
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", initial);
      router.replace(`${pathname}?${params.toString()}`);
    }
    if (initial) {
      localStorage.setItem(LS_KEY, initial);
    }
    setSelected(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(projectId: string) {
    setSelected(projectId);
    localStorage.setItem(LS_KEY, projectId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("projectId", projectId);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (projects.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="w-4 h-4 text-muted-foreground" />
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Resolve projectId server-side: use searchParam, fallback to first project.
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

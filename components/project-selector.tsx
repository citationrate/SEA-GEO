"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";

const LS_KEY = "selectedProjectId";

interface Project {
  id: string;
  name: string;
}

function ProjectSelectorInner({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("projectId");

  const [selected, setSelected] = useState<string>(paramId ?? "");

  // On mount: resolve initial selection from URL > localStorage > first project
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const initial = paramId
      ?? (stored && projects.some((p) => p.id === stored) ? stored : null)
      ?? projects[0]?.id
      ?? "";
    if (initial && initial !== paramId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", initial);
      router.replace(`${pathname}?${params.toString()}`);
    }
    if (initial && typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, initial);
    }
    setSelected(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(projectId: string) {
    setSelected(projectId);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, projectId);
    }
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
        className="bg-muted border border-border rounded-[2px] px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

export function ProjectSelector({ projects }: { projects: Project[] }) {
  return (
    <Suspense fallback={null}>
      <ProjectSelectorInner projects={projects} />
    </Suspense>
  );
}

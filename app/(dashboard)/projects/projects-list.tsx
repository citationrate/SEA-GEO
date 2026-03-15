"use client";

import { useState } from "react";
import { Search, FolderOpen } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface ProjectItem {
  id: string;
  name: string;
  target_brand: string;
}

export function ProjectsList({ projects }: { projects: ProjectItem[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = projects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.target_brand.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="flex items-center gap-2 border border-border rounded-[2px] px-3 py-1.5 w-72 focus-within:border-primary/30 transition-colors" style={{ background: "var(--surface)" }}>
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          placeholder={t("projects.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? t("projects.noProjectFound") : t("projects.noProjectYet")}
          </p>
        </div>
      ) : (
        <div data-tour="projects-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <a key={p.id} href={`/projects/${p.id}`} className="card p-5 block">
              <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{p.target_brand}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

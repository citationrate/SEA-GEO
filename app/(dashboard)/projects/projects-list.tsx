"use client";

import { useState } from "react";
import { Search, FolderOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

interface ProjectItem {
  id: string;
  name: string;
  target_brand: string;
}

export function ProjectsList({ projects }: { projects: ProjectItem[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? t("queries.deleteError"));
      }
    } catch {
      alert(t("deleteProject.networkError"));
    } finally {
      setDeleting(false);
    }
  }

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
            <div key={p.id} className="card p-5 flex items-start justify-between gap-2">
              <a href={`/projects/${p.id}`} className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-foreground">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{p.target_brand}</p>
              </a>
              <button
                onClick={(e) => { e.preventDefault(); setDeleteTarget(p); }}
                className="p-1.5 rounded-[2px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title={t("deleteProject.title")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="card p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-foreground">{t("deleteProject.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("deleteProject.confirmMessage")}
            </p>
            <p className="text-sm font-medium text-foreground">{deleteTarget.name}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-[2px] border border-border text-sm text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-[2px] bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/85 transition-colors disabled:opacity-50"
              >
                {deleting ? t("deleteProject.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/projects");
      } else {
        const data = await res.json();
        alert(data.error ?? t("queries.deleteError"));
      }
    } catch {
      alert(t("deleteProject.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors px-4 py-2 border border-destructive/30 rounded-[2px] hover:bg-destructive/10"
      >
        <Trash2 className="w-4 h-4" />
        {t("deleteProject.title")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="card p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="font-display font-bold text-lg text-foreground">{t("deleteProject.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("deleteProject.confirmMessage")}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold bg-destructive text-white rounded-[2px] hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {loading ? t("deleteProject.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

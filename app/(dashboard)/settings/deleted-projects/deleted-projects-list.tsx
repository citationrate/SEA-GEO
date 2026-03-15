"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface DeletedProject {
  id: string;
  name: string;
  target_brand: string;
  deleted_at: string;
}

export function DeletedProjectsList({ projects }: { projects: DeletedProject[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [restoring, setRestoring] = useState<string | null>(null);

  async function handleRestore(projectId: string) {
    setRestoring(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setRestoring(null);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted-foreground">{t("deletedProjects.noDeleted")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.id} className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {p.target_brand} &middot; {t("deletedProjects.deletedOn")} {new Date(p.deleted_at).toLocaleDateString("it-IT")}
            </p>
          </div>
          <button
            onClick={() => handleRestore(p.id)}
            disabled={restoring === p.id}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[2px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {restoring === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {t("deletedProjects.restore")}
          </button>
        </div>
      ))}
    </div>
  );
}

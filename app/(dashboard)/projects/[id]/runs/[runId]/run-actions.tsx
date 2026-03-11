"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";

export function DeleteRunButton({ runId, projectId }: { runId: string; projectId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/delete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        router.push(`/projects/${projectId}`);
      }
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[2px] border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Elimina
      </button>

      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setShowConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#111416] border border-[rgba(255,255,255,0.1)] rounded-[2px] p-8 max-w-sm w-full space-y-4 shadow-2xl">
              <h3 className="font-display font-bold text-xl text-foreground">Elimina Analisi</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Sei sicuro di voler eliminare questa analisi? Rimarr&agrave; consultabile nell&apos;archivio del progetto.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-sm px-4 py-2 rounded-[2px] border border-[rgba(255,255,255,0.1)] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-sm font-medium px-6 py-2 rounded-[2px] bg-destructive text-white hover:bg-destructive/80 transition-colors disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Elimina
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function RestoreRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/delete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-[2px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      Ripristina
    </button>
  );
}

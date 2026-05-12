"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

export function CancelRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Errore durante l'annullamento");
      toast.success("Run annullata. L'analisi si fermera' al prossimo checkpoint.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors inline-flex items-center gap-1"
      >
        <X className="w-3.5 h-3.5" />
        Annulla analisi
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full p-6 space-y-4 border border-destructive/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-display font-semibold text-foreground">Sei sicuro di voler annullare?</h3>
                <p className="text-sm text-muted-foreground">
                  L'analisi in corso si fermera' al prossimo checkpoint. <span className="text-foreground font-medium">I crediti gia' consumati fino a questo momento non verranno rimborsati.</span>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-[2px] border border-border hover:bg-muted/30 transition-colors disabled:opacity-50"
              >
                Continua l'analisi
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-[2px] bg-destructive text-destructive-foreground hover:bg-destructive/85 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Annulla comunque
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

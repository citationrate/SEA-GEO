"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Loader2, Cpu } from "lucide-react";

const AVAILABLE_MODELS = [
  { id: "gpt-4o" as const, label: "GPT-4o", desc: "Modello principale, alta qualita" },
  { id: "gpt-4o-mini" as const, label: "GPT-4o Mini", desc: "Veloce e economico" },
];

export function AnalysisLauncher({
  projectId,
  hasQueries,
  hasSegments,
}: {
  projectId: string;
  hasQueries: boolean;
  hasSegments: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(["gpt-4o-mini"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function startAnalysis() {
    if (!selected.length) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, models_used: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante l'avvio");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  const canStart = hasQueries && hasSegments;

  return (
    <>
      <button
        onClick={() => canStart ? setOpen(true) : setError("Configura query e segmenti prima di lanciare")}
        className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
      >
        <Play className="w-4 h-4" />
        Lancia Analisi
      </button>

      {!canStart && error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
          <div className="relative card p-6 w-full max-w-md space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg text-foreground">Seleziona Modelli</h2>
              </div>
              <button onClick={() => !loading && setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Ogni query verra eseguita 3 volte per modello, per ogni segmento attivo.
            </p>

            <div className="space-y-3">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => toggle(model.id)}
                  disabled={loading}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selected.includes(model.id)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-muted hover:border-border"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    selected.includes(model.id) ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}>
                    {selected.includes(model.id) && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{model.label}</p>
                    <p className="text-xs text-muted-foreground">{model.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              onClick={startAnalysis}
              disabled={loading || !selected.length}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisi in corso...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Avvia con {selected.length} modell{selected.length === 1 ? "o" : "i"}
                </>
              )}
            </button>

            {loading && (
              <p className="text-xs text-muted-foreground text-center">
                L&apos;analisi puo richiedere diversi minuti. Non chiudere la pagina.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

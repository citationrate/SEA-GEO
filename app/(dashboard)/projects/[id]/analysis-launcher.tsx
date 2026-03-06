"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Loader2, Cpu } from "lucide-react";
import { AI_MODELS, PROVIDER_CONFIG, MODEL_MAP } from "@/lib/engine/models";

const RUN_COUNT = 3;

const PROVIDERS = ["openai", "anthropic", "google", "xai"] as const;

export function AnalysisLauncher({
  projectId,
  hasQueries,
  hasSegments,
  queryCount,
  segmentCount,
}: {
  projectId: string;
  hasQueries: boolean;
  hasSegments: boolean;
  queryCount: number;
  segmentCount: number;
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

  const costEstimate = useMemo(() => {
    if (!selected.length || !queryCount || !segmentCount) return 0;
    const totalPerModel = queryCount * segmentCount * RUN_COUNT;
    return selected.reduce((sum, id) => {
      const model = MODEL_MAP.get(id);
      return sum + (model ? model.costPerQuery * totalPerModel : 0);
    }, 0);
  }, [selected, queryCount, segmentCount]);

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
          <div className="relative card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-5 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg text-foreground">Seleziona i modelli AI per questa analisi</h2>
              </div>
              <button onClick={() => !loading && setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Puoi selezionare piu modelli — ogni prompt verra eseguito su ciascun modello selezionato
            </p>

            {/* Provider sections */}
            <div className="space-y-4">
              {PROVIDERS.map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                const models = AI_MODELS.filter((m) => m.provider === provider);
                return (
                  <div key={provider}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${config.color}`}>
                      {config.label}
                    </p>
                    <div className="space-y-1.5">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => toggle(model.id)}
                          disabled={loading}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                            selected.includes(model.id)
                              ? "border-primary/50 bg-primary/5"
                              : "border-border hover:border-border/80"
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{model.label}</span>
                              <span className="text-[10px] text-muted-foreground">{model.tier}</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            ~${model.costPerQuery}/query
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cost estimate */}
            {selected.length > 0 && queryCount > 0 && segmentCount > 0 && (
              <div className="bg-muted rounded-lg px-4 py-3 text-sm text-muted-foreground">
                Con <span className="text-foreground font-medium">{selected.length}</span> modell{selected.length === 1 ? "o" : "i"},{" "}
                <span className="text-foreground font-medium">{queryCount}</span> query e{" "}
                <span className="text-foreground font-medium">{segmentCount}</span> segment{segmentCount === 1 ? "o" : "i"} attiv{segmentCount === 1 ? "o" : "i"}{" "}
                &rarr; stima costo: <span className="text-foreground font-bold">~€{costEstimate.toFixed(2)}</span>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={startAnalysis}
                disabled={loading || !selected.length}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Avvia Analisi
                  </>
                )}
              </button>
            </div>

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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Check } from "lucide-react";

const RUNS_PER_QUERY = 3;

const DRIVER_OPTIONS = [
  "Prezzo/Convenienza",
  "Qualità del prodotto",
  "Esperienza digitale",
  "Servizio clienti",
  "Reputazione/Trust",
  "Velocità/Tempi",
  "Trasparenza",
];

interface AvailableModel {
  id: string;
  label: string;
  provider: string;
}

export function NewCompetitiveForm({
  projects,
  topCompetitors,
  availableModels,
}: {
  projects: { id: string; name: string; brand: string }[];
  topCompetitors: Record<string, string>;
  availableModels: AvailableModel[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [brandB, setBrandB] = useState(topCompetitors[projects[0]?.id] ?? "");
  const [driver, setDriver] = useState(DRIVER_OPTIONS[0]);
  const [customDriver, setCustomDriver] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>(
    availableModels.length > 0 ? [availableModels[0].id] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((p) => p.id === projectId);
  const effectiveDriver = driver === "Altro" ? customDriver : driver;

  function handleProjectChange(newId: string) {
    setProjectId(newId);
    setBrandB(topCompetitors[newId] ?? "");
  }

  function toggleModel(id: string) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    if (selectedModels.length === availableModels.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(availableModels.map((m) => m.id));
    }
  }

  const totalPrompts = 3 * selectedModels.length * RUNS_PER_QUERY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !brandB.trim() || !effectiveDriver.trim() || selectedModels.length === 0) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/competitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          brand_b: brandB.trim(),
          driver: effectiveDriver.trim(),
          models: selectedModels,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");

      router.push(`/compare/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted-foreground">
          Nessun progetto trovato. Crea prima un progetto per avviare un&apos;analisi competitiva.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {/* Progetto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Progetto *</label>
        <select
          value={projectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="input-base"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.brand}
            </option>
          ))}
        </select>
      </div>

      {/* Brand A / Brand B */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Il tuo brand</label>
          <div className="input-base bg-muted/50 text-muted-foreground cursor-not-allowed">
            {selectedProject?.brand ?? "—"}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Competitor *</label>
          <input
            type="text"
            required
            value={brandB}
            onChange={(e) => setBrandB(e.target.value)}
            placeholder="Es. Vexio"
            className="input-base"
          />
        </div>
      </div>

      {/* Driver */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Driver di confronto *</label>
        <select
          value={driver}
          onChange={(e) => setDriver(e.target.value)}
          className="input-base"
        >
          {DRIVER_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
          <option value="Altro">Altro (testo libero)</option>
        </select>
        {driver === "Altro" && (
          <input
            type="text"
            value={customDriver}
            onChange={(e) => setCustomDriver(e.target.value)}
            placeholder="Specifica il driver..."
            className="input-base mt-2"
            required
          />
        )}
      </div>

      {/* Modelli AI */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Modelli AI *</label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {selectedModels.length === availableModels.length ? "Deseleziona tutti" : "Seleziona tutti"}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availableModels.map((m) => {
            const selected = selectedModels.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModel(m.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-[2px] border text-sm transition-colors text-left ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className={`w-4 h-4 rounded-[2px] border flex items-center justify-center flex-shrink-0 ${
                  selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Config info */}
      <div className="bg-muted/30 border border-border rounded-[2px] px-4 py-3">
        <p className="text-xs text-muted-foreground">
          3 query × {selectedModels.length} modell{selectedModels.length === 1 ? "o" : "i"} × {RUNS_PER_QUERY} run = {totalPrompts} risposte totali
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !brandB.trim() || !effectiveDriver.trim() || selectedModels.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {loading ? "Avvio in corso..." : "Avvia Analisi"}
      </button>
    </form>
  );
}

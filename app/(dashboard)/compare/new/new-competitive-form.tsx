"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

const DRIVER_OPTIONS = [
  "Prezzo/Convenienza",
  "Qualità del prodotto",
  "Esperienza digitale",
  "Servizio clienti",
  "Reputazione/Trust",
  "Velocità/Tempi",
  "Trasparenza",
];

export function NewCompetitiveForm({
  projects,
  topCompetitors,
}: {
  projects: { id: string; name: string; brand: string }[];
  topCompetitors: Record<string, string>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [brandB, setBrandB] = useState(topCompetitors[projects[0]?.id] ?? "");
  const [driver, setDriver] = useState(DRIVER_OPTIONS[0]);
  const [customDriver, setCustomDriver] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((p) => p.id === projectId);
  const effectiveDriver = driver === "Altro" ? customDriver : driver;

  function handleProjectChange(newId: string) {
    setProjectId(newId);
    setBrandB(topCompetitors[newId] ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !brandB.trim() || !effectiveDriver.trim()) return;
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
            placeholder="Es. MSC Crociere"
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

      {/* Config info */}
      <div className="bg-muted/30 border border-border rounded-[2px] px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pilot mode:</span>{" "}
          3 query × 2 modelli (GPT-4o mini, Gemini 2.5 Flash) × 3 run = 18 risposte totali
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !brandB.trim() || !effectiveDriver.trim()}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {loading ? "Avvio in corso..." : "Avvia Analisi"}
      </button>
    </form>
  );
}

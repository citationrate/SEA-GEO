"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Clock, CheckCircle, XCircle, Swords } from "lucide-react";

const DRIVER_OPTIONS = [
  "Prezzo/Convenienza",
  "Qualità del prodotto",
  "Esperienza digitale",
  "Servizio clienti",
  "Reputazione/Trust",
  "Velocità/Tempi",
  "Trasparenza",
];

interface Analysis {
  id: string;
  brand_a: string;
  brand_b: string;
  driver: string;
  status: string;
  comp_score_a: number | null;
  created_at: string;
}

function scoreLabel(score: number | null): { text: string; cls: string } {
  if (score == null) return { text: "—", cls: "text-muted-foreground" };
  if (score >= 60) return { text: "Dominante", cls: "text-primary" };
  if (score >= 40) return { text: "Competitivo", cls: "text-[#c4a882]" };
  return { text: "Svantaggiato", cls: "text-destructive" };
}

export function CompetitiveForm({
  projectId,
  brandA,
  suggestedCompetitor,
  analyses,
}: {
  projectId: string;
  brandA: string;
  suggestedCompetitor: string;
  analyses: Analysis[];
}) {
  const router = useRouter();
  const [brandB, setBrandB] = useState(suggestedCompetitor);
  const [driver, setDriver] = useState(DRIVER_OPTIONS[0]);
  const [customDriver, setCustomDriver] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const effectiveDriver = driver === "Altro" ? customDriver : driver;

  async function handleStart() {
    if (!brandB.trim() || !effectiveDriver.trim()) return;
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

      router.push(`/projects/${projectId}/competitive/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="card p-6 space-y-5">
        <h2 className="font-display font-semibold text-foreground">Nuova Analisi Competitiva</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Brand A (locked) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Il tuo brand</label>
            <div className="input-base bg-muted/50 text-muted-foreground cursor-not-allowed">
              {brandA}
            </div>
          </div>

          {/* Brand B */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Competitor *</label>
            <input
              type="text"
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
          onClick={handleStart}
          disabled={loading || !brandB.trim() || !effectiveDriver.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Avvio in corso..." : "Avvia Analisi"}
        </button>
      </div>

      {/* Past analyses */}
      {analyses.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-foreground">Analisi precedenti</h2>
          <div className="space-y-2">
            {analyses.map((a) => {
              const StatusIcon = a.status === "completed" ? CheckCircle
                : a.status === "failed" ? XCircle
                : a.status === "running" ? Loader2
                : Clock;
              const statusCls = a.status === "completed" ? "text-primary"
                : a.status === "failed" ? "text-destructive"
                : a.status === "running" ? "text-yellow-500 animate-spin"
                : "text-muted-foreground";
              const label = scoreLabel(a.comp_score_a);

              return (
                <a
                  key={a.id}
                  href={`/projects/${projectId}/competitive/${a.id}`}
                  className="flex items-center justify-between bg-muted rounded-[2px] px-4 py-3 border border-border hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Swords className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {a.brand_a} vs {a.brand_b}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.driver}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.comp_score_a != null && (
                      <span className={`text-sm font-bold ${label.cls}`}>
                        {Math.round(a.comp_score_a)} — {label.text}
                      </span>
                    )}
                    <StatusIcon className={`w-4 h-4 ${statusCls}`} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

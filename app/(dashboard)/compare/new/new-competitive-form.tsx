"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Sparkles, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { COMPARISON_MODEL_IDS, PROVIDER_GROUPS } from "@/lib/engine/models";
import { useUsage } from "@/lib/hooks/useUsage";

const RUNS_PER_QUERY = 3;

/** Build comparison provider cards from the canonical PROVIDER_GROUPS, filtered to comparison models only */
const COMPARISON_PROVIDERS = PROVIDER_GROUPS
  .map((g) => {
    const model = g.models.find((m) => (COMPARISON_MODEL_IDS as readonly string[]).includes(m.id));
    if (!model) return null;
    return { providerId: g.id, providerLabel: g.label, badge: g.badge, color: g.color, modelId: model.id, modelLabel: model.label, descriptionKey: model.descriptionKey };
  })
  .filter(Boolean) as { providerId: string; providerLabel: string; badge: string; color: string; modelId: string; modelLabel: string; descriptionKey: string }[];

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
  const { t } = useTranslation();
  const usage = useUsage();

  const driverLabels: Record<string, string> = {
    "Prezzo/Convenienza": t("competitiveForm.driverPrice"),
    "Qualità del prodotto": t("competitiveForm.driverQuality"),
    "Esperienza digitale": t("competitiveForm.driverDigital"),
    "Servizio clienti": t("competitiveForm.driverService"),
    "Reputazione/Trust": t("competitiveForm.driverReputation"),
    "Velocità/Tempi": t("competitiveForm.driverSpeed"),
    "Trasparenza": t("competitiveForm.driverTransparency"),
  };
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [brandB, setBrandB] = useState(topCompetitors[projects[0]?.id] ?? "");
  const [driver, setDriver] = useState(DRIVER_OPTIONS[0]);
  const [customDriver, setCustomDriver] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedQueries, setGeneratedQueries] = useState<{ pattern: string; text: string }[] | null>(null);
  const [generatingQueries, setGeneratingQueries] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(COMPARISON_MODEL_IDS));

  const selectedProject = projects.find((p) => p.id === projectId);
  const effectiveDriver = driver === "Altro" ? customDriver : driver;

  const comparisonsExhausted = !usage.loading && usage.comparisonsLimit > 0 && usage.comparisonsRemaining <= 0;

  // Next month reset date (1st of next month)
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1, 1);
  const resetDateStr = resetDate.toLocaleDateString(undefined, { day: "numeric", month: "long" });

  function toggleModel(modelId: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        if (next.size <= 1) return prev; // minimum 1
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }

  function handleProjectChange(newId: string) {
    setProjectId(newId);
    setBrandB(topCompetitors[newId] ?? "");
  }

  async function generateCustomQueries() {
    if (!selectedProject?.brand || !brandB.trim() || !customDriver.trim()) return;
    setGeneratingQueries(true);
    try {
      const res = await fetch("/api/competitive/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandA: selectedProject.brand,
          brandB: brandB.trim(),
          customDriver: customDriver.trim(),
          sector: "",
        }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setGeneratedQueries(data);
      }
    } catch {
      // Silently fail — user can still proceed with default templates
    } finally {
      setGeneratingQueries(false);
    }
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
          models: Array.from(selectedModels),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("common.error"));

      router.push(`/compare/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted-foreground">
          {t("competitiveForm.noProjectFound")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {/* Progetto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">{t("competitiveForm.project")} *</label>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("competitiveForm.yourBrand")}</label>
          <div className="input-base bg-muted/50 text-muted-foreground cursor-not-allowed">
            {selectedProject?.brand ?? "—"}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("competitiveForm.competitor")} *</label>
          <input
            type="text"
            required
            value={brandB}
            onChange={(e) => setBrandB(e.target.value)}
            placeholder={t("competitiveForm.competitorPlaceholder")}
            className="input-base"
          />
        </div>
      </div>

      {/* Driver */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">{t("competitiveForm.comparisonDriver")} *</label>
        <select
          value={driver}
          onChange={(e) => setDriver(e.target.value)}
          className="input-base"
        >
          {DRIVER_OPTIONS.map((d) => (
            <option key={d} value={d}>{driverLabels[d] || d}</option>
          ))}
          <option value="Altro">{t("competitiveForm.otherFreeText")}</option>
        </select>
        {driver === "Altro" && (
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customDriver}
                onChange={(e) => { setCustomDriver(e.target.value); setGeneratedQueries(null); }}
                placeholder={t("competitiveForm.specifyDriver")}
                className="input-base flex-1"
                required
              />
              <button
                type="button"
                onClick={generateCustomQueries}
                disabled={generatingQueries || !customDriver.trim() || !brandB.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-medium rounded-[2px] hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {generatingQueries ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingQueries ? t("competitiveForm.generating") : t("competitiveForm.generateQuery")}
              </button>
            </div>

            {generatedQueries && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("competitiveForm.generatedQueries")}</p>
                  <button
                    type="button"
                    onClick={generateCustomQueries}
                    disabled={generatingQueries}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${generatingQueries ? "animate-spin" : ""}`} />
                    {t("competitiveForm.regenerate")}
                  </button>
                </div>
                {generatedQueries.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="badge badge-primary text-[12px] mt-1.5 shrink-0">{q.pattern}</span>
                    <textarea
                      value={q.text}
                      onChange={(e) => {
                        const updated = [...generatedQueries];
                        updated[i] = { ...updated[i], text: e.target.value };
                        setGeneratedQueries(updated);
                      }}
                      rows={2}
                      className="input-base flex-1 text-xs leading-relaxed resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage counter */}
      {!usage.loading && (
        <div className="bg-muted/30 border border-border rounded-[2px] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("competitiveForm.comparisons")} {t("competitiveForm.usedThisMonth")}</span>
            <span className={`text-xs font-semibold ${
              usage.comparisonsRemaining > 5 ? "text-foreground" : usage.comparisonsRemaining >= 2 ? "text-warning" : "text-destructive"
            }`}>
              {usage.comparisonsUsed} / {usage.comparisonsLimit}
            </span>
          </div>
          <div className="w-full h-1.5 bg-ink-3 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-all duration-500"
              style={{
                width: usage.comparisonsLimit > 0 ? `${(usage.comparisonsUsed / usage.comparisonsLimit) * 100}%` : "0%",
                backgroundColor: usage.comparisonsRemaining > 5 ? "var(--success)" : usage.comparisonsRemaining >= 2 ? "var(--warning)" : "var(--destructive)",
              }}
            />
          </div>
        </div>
      )}

      {/* Model selector — provider cards like project creation */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">{t("competitiveForm.aiModels")}</label>
        <p className="text-xs text-muted-foreground">
          {t("competitiveForm.aiModelsDesc")}
        </p>
        <div className="space-y-2">
          {COMPARISON_PROVIDERS.map((p) => {
            const isSelected = selectedModels.has(p.modelId);
            return (
              <button
                key={p.modelId}
                type="button"
                onClick={() => toggleModel(p.modelId)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm border transition-all text-left ${
                  isSelected
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isSelected ? p.color : "text-muted-foreground"}`}>{p.providerLabel}</span>
                    <span className="font-mono text-[0.69rem] tracking-wide text-muted-foreground">{p.badge}</span>
                    <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>— {p.modelLabel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(p.descriptionKey)}</p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-bold">{selectedModels.size}</span> {t("competitiveForm.modelWord")} {t("competitiveForm.selectedSummary")} · {RUNS_PER_QUERY} {t("competitiveForm.runsPerQuery")}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {comparisonsExhausted ? (
        <div className="w-full text-center py-3 px-4 bg-destructive/10 border border-destructive/30 rounded-[2px]">
          <p className="text-sm text-destructive font-medium">
            {t("competitiveForm.allUsed")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("competitiveForm.resetsOn")} {resetDateStr}.
          </p>
        </div>
      ) : (
        <button
          type="submit"
          disabled={loading || !brandB.trim() || !effectiveDriver.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? t("competitiveForm.starting") : t("analysisLauncher.startAnalysis")}
        </button>
      )}
    </form>
  );
}

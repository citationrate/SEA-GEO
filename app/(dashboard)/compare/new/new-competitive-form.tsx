"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Check, Sparkles, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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

interface ProviderGroup {
  id: string;
  label: string;
  badge: string;
  color: string;
  models: { id: string; label: string; descriptionKey: string }[];
}

export function NewCompetitiveForm({
  projects,
  topCompetitors,
  providerGroups,
}: {
  projects: { id: string; name: string; brand: string }[];
  topCompetitors: Record<string, string>;
  providerGroups: ProviderGroup[];
}) {
  const router = useRouter();
  const { t } = useTranslation();

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
  const [selectedModels, setSelectedModels] = useState<string[]>(
    providerGroups[0]?.models[0] ? [providerGroups[0].models[0].id] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedQueries, setGeneratedQueries] = useState<{ pattern: string; text: string }[] | null>(null);
  const [generatingQueries, setGeneratingQueries] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId);
  const effectiveDriver = driver === "Altro" ? customDriver : driver;

  const allModelIds = providerGroups.flatMap((g) => g.models.map((m) => m.id));

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
    if (selectedModels.length === allModelIds.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(allModelIds);
    }
  }

  const totalPrompts = 3 * selectedModels.length * RUNS_PER_QUERY;

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
      <div className="grid grid-cols-2 gap-4">
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

      {/* Modelli AI — grouped by provider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">{t("projects.aiModels")} *</label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {selectedModels.length === allModelIds.length ? t("generateQueries.deselectAll") : t("generateQueries.selectAll")}
          </button>
        </div>
        <div className="space-y-2">
          {providerGroups.map((group) => {
            const hasSelected = group.models.some((m) => selectedModels.includes(m.id));
            return (
              <div
                key={group.id}
                className={`rounded-sm border transition-all ${
                  hasSelected ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-sm font-semibold ${group.color}`}>{group.label}</span>
                  <span className="font-mono text-[0.69rem] tracking-wide text-muted-foreground">{group.badge}</span>
                </div>
                <div className="px-4 pb-3 pt-0 space-y-0.5">
                  {group.models.map((m) => {
                    const selected = selectedModels.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        onClick={() => toggleModel(m.id)}
                        className={`flex items-center gap-2 p-2 rounded-[2px] cursor-pointer transition-colors ${
                          selected ? "bg-primary/10" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-[2px] border flex items-center justify-center flex-shrink-0 ${
                          selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>{m.label}</span>
                          <p className="text-xs text-muted-foreground">{t(m.descriptionKey)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Config info */}
      <div className="bg-muted/30 border border-border rounded-[2px] px-4 py-3">
        <p className="text-xs text-muted-foreground">
          3 query × {selectedModels.length} {selectedModels.length === 1 ? t("analysisLauncher.modelSingular") : t("analysisLauncher.modelPlural")} × {RUNS_PER_QUERY} run = {totalPrompts} {t("competitiveForm.totalResponses")}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !brandB.trim() || !effectiveDriver.trim() || selectedModels.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {loading ? t("competitiveForm.starting") : t("analysisLauncher.startAnalysis")}
      </button>
    </form>
  );
}

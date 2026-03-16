"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Check, Users, Plus, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { Persona } from "@/lib/query-generator";

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
  const [personasEnabled, setPersonasEnabled] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  function addPersona() {
    if (personas.length >= 3) return;
    setPersonas([...personas, { id: crypto.randomUUID(), mode: "demographic" }]);
  }

  function updatePersona(idx: number, updates: Partial<Persona>) {
    setPersonas(personas.map((p, i) => i === idx ? { ...p, ...updates } : p));
  }

  function removePersona(idx: number) {
    setPersonas(personas.filter((_, i) => i !== idx));
  }

  const baseQueries = 3;
  const personaQueries = personasEnabled ? personas.length * 2 : 0;
  const totalQueries = baseQueries + personaQueries;
  const totalPrompts = totalQueries * selectedModels.length * RUNS_PER_QUERY;

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
          personas: personasEnabled ? personas : [],
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
            placeholder="Es. Vexio"
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
          <input
            type="text"
            value={customDriver}
            onChange={(e) => setCustomDriver(e.target.value)}
            placeholder={t("competitiveForm.specifyDriver")}
            className="input-base mt-2"
            required
          />
        )}
      </div>

      {/* Personas */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-medium text-foreground">{t("generateQueries.personasTitle")}</h3>
          <InfoTooltip text={t("generateQueries.personasTooltip")} />
        </div>

        <div className="rounded-[2px] border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("generateQueries.personasDesc")}
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => {
              setPersonasEnabled(!personasEnabled);
              if (personasEnabled) setPersonas([]);
            }}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${personasEnabled ? "bg-purple-500" : "bg-border"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${personasEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm font-medium text-foreground">{t("generateQueries.activatePersonas")}</span>
          <span className="text-xs text-muted-foreground">(max 3)</span>
        </label>

        {personasEnabled && (
          <div className="space-y-4">
            {personas.map((p, idx) => (
              <div key={p.id} className="card border border-purple-500/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Persona {idx + 1}</span>
                  <button type="button" onClick={() => removePersona(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Nome persona */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t("generateQueries.personaName")}</label>
                  <input
                    type="text"
                    value={p.nome || ""}
                    onChange={(e) => updatePersona(idx, { nome: e.target.value })}
                    placeholder='es. "Mamma attenta alla salute"'
                    className="input-base w-full"
                  />
                </div>

                {/* B2C / B2B toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updatePersona(idx, { mode: "demographic" })}
                    className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                      p.mode === "demographic" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t("generateQueries.b2cDemographic")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePersona(idx, { mode: "decision_drivers" })}
                    className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                      p.mode === "decision_drivers" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t("generateQueries.b2bDecisionMaker")}
                  </button>
                </div>

                {p.mode === "demographic" ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.age")}</label>
                      <input type="text" value={p.eta || ""} onChange={(e) => updatePersona(idx, { eta: e.target.value })} placeholder="es. 30-45" className="input-base w-full" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.gender")}</label>
                      <select value={p.sesso || ""} onChange={(e) => updatePersona(idx, { sesso: e.target.value })} className="input-base w-full">
                        <option value="">—</option>
                        <option value="M">{t("generateQueries.man")}</option>
                        <option value="F">{t("generateQueries.woman")}</option>
                        <option value="altro">{t("sources.other")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.situation")}</label>
                      <input type="text" value={p.situazione || ""} onChange={(e) => updatePersona(idx, { situazione: e.target.value })} placeholder="es. cucina per la famiglia" className="input-base w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.role")}</label>
                      <input type="text" value={p.ruolo || ""} onChange={(e) => updatePersona(idx, { ruolo: e.target.value })} placeholder="es. responsabile acquisti" className="input-base w-full" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.sector")}</label>
                      <input type="text" value={p.settore || ""} onChange={(e) => updatePersona(idx, { settore: e.target.value })} placeholder="es. ristorazione" className="input-base w-full" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("generateQueries.mainProblem")}</label>
                      <input type="text" value={p.problema || ""} onChange={(e) => updatePersona(idx, { problema: e.target.value })} placeholder="es. costi di approvvigionamento" className="input-base w-full" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {personas.length < 3 && (
              <button
                type="button"
                onClick={addPersona}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t("generateQueries.addPersona")}
              </button>
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
          {totalQueries} query{personaQueries > 0 ? ` (3 base + ${personaQueries} persona)` : ""} × {selectedModels.length} modell{selectedModels.length === 1 ? "o" : "i"} × {RUNS_PER_QUERY} run = {totalPrompts} {t("competitiveForm.totalResponses")}
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

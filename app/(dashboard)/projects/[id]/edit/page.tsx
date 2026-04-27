"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Cpu, Info, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";
import { PROVIDER_GROUPS, MODEL_MAP } from "@/lib/engine/models";
import { getEffectivePlanId } from "@/lib/utils/is-pro";

const BASE_MODEL_LIMIT = 3;
const PRO_MODEL_LIMIT = 5;

const SECTOR_OPTIONS = [
  "Turismo",
  "Alimentare",
  "Bevande",
  "Tech",
  "Moda",
  "Finance",
  "Automotive",
  "Pharma",
  "Energia",
  "Altro",
];

const BRAND_TYPE_OPTIONS = [
  { value: "manufacturer", label: "Produttore / Brand" },
  { value: "retailer", label: "Retailer / GDO" },
  { value: "service", label: "Servizio / Subscription" },
  { value: "financial", label: "Finanziario / Assicurativo" },
  { value: "platform", label: "Piattaforma / Marketplace" },
  { value: "local", label: "Business Locale / Catena" },
  { value: "publisher", label: "Media / Editore / Publisher" },
  { value: "pharma", label: "Pharma / Healthcare" },
  { value: "utility", label: "Utility / Energia / Telco" },
];

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sector, setSector] = useState("");
  const [brandType, setBrandType] = useState("manufacturer");
  const [marketContext, setMarketContext] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [country, setCountry] = useState("");
  const [initialModels, setInitialModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [planId, setPlanId] = useState<"demo" | "base" | "pro" | "enterprise">("demo");
  const { t } = useTranslation();

  const isProPlan = planId === "pro" || planId === "enterprise";
  const isDemoPlan = planId === "demo";
  const modelCap = isProPlan ? PRO_MODEL_LIMIT : BASE_MODEL_LIMIT;
  const dirtyModels = JSON.stringify([...selectedModels].sort()) !== JSON.stringify([...initialModels].sort());

  useEffect(() => {
    async function load() {
      const [projRes, profRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/profile"),
      ]);
      if (!projRes.ok) {
        setError(t("editProject.loadError"));
        setLoading(false);
        return;
      }
      const project = await projRes.json();
      setName(project.name ?? "");
      setTargetBrand(project.target_brand ?? "");
      setWebsiteUrl(project.website_url ?? "");
      setSector(project.sector ?? "");
      setBrandType(project.brand_type ?? "manufacturer");
      setMarketContext(project.market_context ?? "");
      setLanguage(project.language ?? "it");
      setCountry(project.country ?? "");
      const models = (project.models_config ?? []) as string[];
      setInitialModels(models);
      setSelectedModels(models);
      if (profRes.ok) {
        const prof = await profRes.json();
        setPlanId(getEffectivePlanId(prof?.plan));
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  function toggleModel(modelId: string) {
    // Locked models (already in the project) can never be removed
    if (initialModels.includes(modelId)) return;
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((m) => m !== modelId);
      }
      if (prev.length >= modelCap) return prev;
      return [...prev, modelId];
    });
  }

  // Auto-scroll to the models section when arriving with #models in the URL.
  // Runs after the form has rendered (post-loading) so the anchor exists.
  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#models") return;
    const el = document.getElementById("models");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          target_brand: targetBrand,
          website_url: websiteUrl || null,
          sector: sector || null,
          brand_type: brandType || null,
          market_context: marketContext || null,
          language,
          country: country || null,
          ...(dirtyModels ? { models_config: selectedModels } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("projects.saveError"));
      }

      toast.success("Progetto aggiornato");
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.unknownError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("nav.backToProject")}
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("editProject.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("editProject.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA" && (e.target as HTMLElement).getAttribute("type") !== "submit") e.preventDefault(); }} className="card p-6 space-y-5">
        {/* Nome progetto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.projectName")} *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Analisi Brand 2026"
            className="input-base"
          />
        </div>

        {/* Brand rilevato */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.targetBrand")} *
            <InfoTooltip text={t("projects.targetBrandTooltip")} />
          </label>
          <input
            type="text"
            required
            value={targetBrand}
            onChange={(e) => setTargetBrand(e.target.value)}
            placeholder="Es. Lumora"
            className="input-base"
          />
        </div>

        {/* Sito web */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.website")} *
            <InfoTooltip text={t("projects.websiteTooltip")} />
          </label>
          <input
            type="text"
            required
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Es. lumora.it"
            className="input-base"
          />
        </div>

        {/* Settore e Tipo Brand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("projects.sector")}
              <InfoTooltip text={t("projects.sectorTooltip")} />
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="input-base"
            >
              <option value="">{t("projects.selectSector")}</option>
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("projects.brandType")}
              <InfoTooltip text={t("projects.brandTypeTooltip")} />
            </label>
            <select
              value={brandType}
              onChange={(e) => setBrandType(e.target.value)}
              className="input-base"
            >
              {BRAND_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lingua e Paese */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("projects.language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "it" | "en")}
              className="input-base"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("projects.country")}</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Es. Italia"
              className="input-base"
            />
          </div>
        </div>

        {/* Contesto di mercato */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.marketContext")}</label>
          <textarea
            value={marketContext}
            onChange={(e) => setMarketContext(e.target.value)}
            placeholder="Descrivi il settore, il posizionamento e il pubblico target..."
            rows={4}
            className="input-base resize-none"
          />
        </div>

        {/* Modelli AI — picker (additions only, no removals) */}
        <div id="models" className="space-y-2 scroll-mt-6">
          <label className="text-sm font-medium text-foreground">{t("projects.aiModels")}</label>

          {isDemoPlan ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 flex-wrap bg-muted/50 border border-border rounded-[2px] px-4 py-3">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                {initialModels.length > 0 ? (
                  initialModels.map((m) => (
                    <span key={m} className="badge badge-primary text-[12px]">{MODEL_MAP.get(m)?.label ?? m}</span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{t("editProject.noModelConfigured")}</span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{t("editProject.modelsFixed")}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Aggiungi nuovi modelli al progetto. I modelli esistenti restano fissi (servono per i trend storici comparabili).
              </p>
              <div className="space-y-2">
                {PROVIDER_GROUPS.map((provider) => {
                  const isSoon = !!provider.comingSoon;
                  return (
                    <div key={provider.id} className={`rounded-sm border ${isSoon ? "border-border opacity-50" : "border-border"}`}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className={`text-sm font-semibold ${isSoon ? "text-muted-foreground" : provider.color}`}>{provider.label}</span>
                        <span className="font-mono text-[0.69rem] tracking-wide text-muted-foreground">{provider.badge}</span>
                        {isSoon && (
                          <span className="font-mono text-[0.69rem] tracking-wide text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] ml-auto">SOON</span>
                        )}
                      </div>
                      {!isSoon && (
                        <div className="px-4 pb-3 pt-0 space-y-0.5">
                          {provider.models.map((model) => {
                            const isLocked = initialModels.includes(model.id);
                            const isSelected = selectedModels.includes(model.id);
                            const isProGated = !!model.proOnly && !isProPlan;
                            const atCap = !isSelected && selectedModels.length >= modelCap;
                            const disabled = isLocked || isProGated || atCap;
                            return (
                              <label key={model.id} onClick={() => !disabled && toggleModel(model.id)}
                                className={`flex items-center gap-2 p-2 rounded-[2px] transition-colors ${
                                  isLocked ? "bg-muted/40 cursor-default"
                                    : isProGated ? "opacity-60 cursor-not-allowed"
                                    : atCap ? "opacity-50 cursor-not-allowed"
                                    : isSelected ? "bg-primary/10 cursor-pointer"
                                    : "hover:bg-muted/30 cursor-pointer"
                                }`}
                                title={isLocked ? "Modello storico — non rimovibile" : isProGated ? "Disponibile solo dal piano Pro" : atCap ? `Limite del piano: max ${modelCap} modelli` : undefined}>
                                <div className={`w-3.5 h-3.5 rounded-[2px] border-2 flex items-center justify-center shrink-0 ${
                                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                }`}>
                                  {isSelected && (
                                    <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium ${isProGated ? "text-muted-foreground" : isSelected ? "text-primary" : "text-foreground"}`}>{model.label}</span>
                                    {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                                    {isProGated && <span className="font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">PRO</span>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{t(model.descriptionKey)}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>I modelli storici restano sempre attivi.</span>
                </div>
                <span>
                  <span className="text-foreground font-bold">{selectedModels.length}</span>
                  {" / "}{modelCap} modelli
                </span>
              </div>

              {/* CTA upgrade: shown to Base when at-cap or there are pro-only models on the table */}
              {!isProPlan && (selectedModels.length >= modelCap || PROVIDER_GROUPS.some((g) => g.models.some((m) => m.proOnly))) && (
                <a
                  href="/piano"
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-[3px] border border-[#c4a882]/30 bg-[#c4a882]/5 hover:bg-[#c4a882]/10 hover:border-[#c4a882]/50 transition-colors"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">
                      {selectedModels.length >= modelCap ? "Hai raggiunto il limite del piano" : "Vuoi accesso ai modelli Pro?"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Passa a Pro per usare fino a 5 modelli e sbloccare Opus 4.7, GPT-5.5 Pro, Gemini 3.1 Pro, Sonar Pro e Grok 3.
                    </p>
                  </div>
                  <span className="text-xs font-mono tracking-wide text-[#c4a882] whitespace-nowrap">PASSA A PRO →</span>
                </a>
              )}
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("common.saving") : t("editProject.saveChanges")}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Info, Lock, ChevronRight, Globe } from "lucide-react";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";
import { AVI_PROVIDER_CARDS, AVI_DEMO_PROVIDERS, providersToModelIds, modelIdToProviderId } from "@citationrate/llm-client";
import { BrandLogo } from "@/components/brand-logos";
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
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [initialProviders, setInitialProviders] = useState<string[]>([]);
  const [planId, setPlanId] = useState<"demo" | "base" | "pro" | "enterprise">("demo");
  const { t } = useTranslation();

  const isDemoPlan = planId === "demo";
  const providerCap = planId === "enterprise" ? AVI_PROVIDER_CARDS.length
    : planId === "pro" ? PRO_MODEL_LIMIT
    : BASE_MODEL_LIMIT;
  const atLimit = selectedProviders.length >= providerCap;
  const dirtyProviders = JSON.stringify([...selectedProviders].sort()) !== JSON.stringify([...initialProviders].sort());

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
      // Strip orphan/legacy IDs that aren't in the public selectors anymore
      // (e.g. "gpt-5.4" from before the OpenAI list was reshuffled) from the
      // current selection — there's no checkbox for them, so the user can't
      // see or untick them. Keep `initialModels` as the raw DB value so the
      // dirty check picks up the implicit cleanup and persists it on the
      // very next save. Same filter runs server-side as belt-and-braces.
      // Derive providers selezionati dai model id salvati (un model -> un provider).
      // Uniq + filtra eventuali model id non riconosciuti (legacy retired).
      const rawModels = (project.models_config ?? []) as string[];
      const providers = Array.from(new Set(
        rawModels.map((id) => modelIdToProviderId(id)).filter((p): p is NonNullable<typeof p> => p !== null)
      ));
      setSelectedProviders(providers);
      setInitialProviders(providers);
      if (profRes.ok) {
        const prof = await profRes.json();
        setPlanId(getEffectivePlanId(prof?.plan));
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  function toggleProvider(providerId: string) {
    setSelectedProviders((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((p) => p !== providerId);
      }
      if (prev.length >= providerCap) return prev;
      return [...prev, providerId];
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
          ...(dirtyProviders ? { models_config: providersToModelIds(selectedProviders, planId) } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("projects.saveError"));
      }

      toast.success(t("editProject.projectUpdated"));
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
            placeholder={t("editProject.namePlaceholder")}
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
            placeholder={t("editProject.brandPlaceholder")}
            className="input-base"
          />
        </div>

        {/* Lingua — promossa in cima per coerenza con /new */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-primary" />
            {t("projects.language")} <span className="text-destructive" aria-hidden>*</span>
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "it" | "en")}
            className="input-base"
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Sito web */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.website")} <span className="text-destructive" aria-hidden>*</span>
            <InfoTooltip text={t("projects.websiteTooltip")} />
          </label>
          <input
            type="text"
            required
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder={t("editProject.websitePlaceholder")}
            className="input-base"
          />
        </div>

        {/* Contesto di mercato (opzionale) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.marketContext")}
            <span className="text-xs font-normal text-muted-foreground">{t("editProject.marketOptional")}</span>
          </label>
          <textarea
            value={marketContext}
            onChange={(e) => setMarketContext(e.target.value)}
            placeholder={t("editProject.marketPlaceholder")}
            rows={4}
            className="input-base resize-none"
          />
        </div>

        {/* Provider AI — card selection (1 provider = 1 modello risolto per piano) */}
        <div id="models" className="space-y-2 scroll-mt-6">
          <label className="text-sm font-medium text-foreground">{t("projects.aiModels")}</label>

          {isDemoPlan ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {AVI_DEMO_PROVIDERS.map((pid) => {
                  const p = AVI_PROVIDER_CARDS.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
                      <BrandLogo id={p.id} size={16} />
                      <span className="font-mono text-[0.69rem] tracking-wide text-foreground">{p.badge}</span>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{t("editProject.modelsFixed")}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("editProject.selectProvidersHint").replace("{cap}", String(providerCap))}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVI_PROVIDER_CARDS.map((p) => {
                  const isSelected = selectedProviders.includes(p.id);
                  const capReached = !isSelected && atLimit;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => !capReached && toggleProvider(p.id)}
                      disabled={capReached}
                      className={`flex items-center gap-3 px-4 py-3 rounded-sm border text-left transition-all ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : capReached
                            ? "border-border opacity-50 cursor-not-allowed"
                            : "border-border hover:bg-muted/30"
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
                      <BrandLogo id={p.id} size={20} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{p.badge}</div>
                        <div className="font-mono text-[0.62rem] tracking-wide text-muted-foreground">{p.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>{t("editProject.historyAvailable")}</span>
                </div>
                <span>
                  <span className="text-foreground font-bold">{selectedProviders.length}</span>
                  {" / "}{providerCap} {t("editProject.providerCount")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Avanzato: settore, tipo brand, paese (opzionali). */}
        <details className="group rounded-sm border border-border">
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
            {t("editProject.advancedOptions")}
            <span className="text-xs font-normal text-muted-foreground ml-auto">{t("editProject.advancedHint")}</span>
          </summary>
          <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border">
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t("projects.country")}</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={t("editProject.countryPlaceholder")}
                className="input-base"
              />
            </div>
          </div>
        </details>

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

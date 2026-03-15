"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Loader2, Lock, Check, ArrowRight, Crown, Search, ChevronDown } from "lucide-react";
import { PROVIDER_GROUPS } from "@/lib/engine/models";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import confetti from "canvas-confetti";
import { useTranslation } from "@/lib/i18n/context";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

interface ProviderOption {
  id: string;
  label: string;
  badge: string;
  models: ModelOption[];
  comingSoon?: boolean;
}

const COUNTRIES = [
  "Globale / Worldwide",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
  "Antigua e Barbuda", "Arabia Saudita", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaigian",
  "Bahamas", "Bahrein", "Bangladesh", "Barbados", "Belgio", "Belize",
  "Benin", "Bhutan", "Bielorussia", "Bolivia", "Bosnia ed Erzegovina",
  "Botswana", "Brasile", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambogia", "Camerun", "Canada", "Capo Verde", "Ciad", "Cile", "Cina",
  "Cipro", "Colombia", "Comore", "Corea del Nord", "Corea del Sud",
  "Costa d'Avorio", "Costa Rica", "Croazia", "Cuba",
  "Danimarca", "Dominica",
  "Ecuador", "Egitto", "El Salvador", "Emirati Arabi Uniti", "Eritrea",
  "Estonia", "Eswatini", "Etiopia",
  "Figi", "Filippine", "Finlandia", "Francia",
  "Gabon", "Gambia", "Georgia", "Germania", "Ghana", "Giamaica",
  "Giappone", "Gibuti", "Giordania", "Grecia", "Grenada", "Guatemala",
  "Guinea", "Guinea Equatoriale", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras",
  "India", "Indonesia", "Iran", "Iraq", "Irlanda", "Islanda", "Israele",
  "Italia",
  "Kazakistan", "Kenya", "Kirghizistan", "Kiribati", "Kuwait",
  "Laos", "Lesotho", "Lettonia", "Libano", "Liberia", "Libia",
  "Liechtenstein", "Lituania", "Lussemburgo",
  "Macedonia del Nord", "Madagascar", "Malawi", "Malaysia", "Maldive",
  "Mali", "Malta", "Marocco", "Mauritania", "Mauritius", "Messico",
  "Micronesia", "Moldavia", "Monaco", "Mongolia", "Montenegro",
  "Mozambico", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Nicaragua", "Niger", "Nigeria", "Norvegia",
  "Nuova Zelanda",
  "Oman",
  "Paesi Bassi", "Pakistan", "Palau", "Palestina", "Panama",
  "Papua Nuova Guinea", "Paraguay", "Perù", "Polonia", "Portogallo",
  "Qatar",
  "Regno Unito", "Repubblica Ceca", "Repubblica Centrafricana",
  "Repubblica del Congo", "Repubblica Democratica del Congo",
  "Repubblica Dominicana", "Romania", "Ruanda", "Russia",
  "Saint Kitts e Nevis", "Saint Lucia", "Saint Vincent e Grenadine",
  "Samoa", "San Marino", "São Tomé e Príncipe", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Siria", "Slovacchia",
  "Slovenia", "Somalia", "Spagna", "Sri Lanka", "Stati Uniti",
  "Sud Africa", "Sudan", "Sudan del Sud", "Suriname", "Svezia",
  "Svizzera",
  "Tagikistan", "Taiwan", "Tanzania", "Thailandia", "Timor Est", "Togo",
  "Tonga", "Trinidad e Tobago", "Tunisia", "Turchia", "Turkmenistan",
  "Tuvalu",
  "Ucraina", "Uganda", "Ungheria", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vaticano", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe",
];

const BASE_MODEL_LIMIT = 3;

export default function NewProjectPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [existingProjectCount, setExistingProjectCount] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);

  const AVAILABLE_PROVIDERS: ProviderOption[] = PROVIDER_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    badge: g.badge,
    comingSoon: g.comingSoon,
    models: g.models.map((m) => ({
      id: m.id,
      label: m.label,
      description: t(m.descriptionKey),
    })),
  }));

  const SECTORS = [
    { value: "Turismo", label: t("sectors.tourism") },
    { value: "Alimentare", label: t("sectors.food") },
    { value: "Bevande", label: t("sectors.beverages") },
    { value: "Tech", label: t("sectors.tech") },
    { value: "Moda", label: t("sectors.fashion") },
    { value: "Finance", label: t("sectors.finance") },
    { value: "Automotive", label: t("sectors.automotive") },
    { value: "Pharma", label: t("sectors.pharma") },
    { value: "Energia", label: t("sectors.energy") },
    { value: "Altro", label: t("sectors.other") },
  ];

  const BRAND_TYPES = [
    { value: "manufacturer", label: t("brandTypes.manufacturer") },
    { value: "retailer", label: t("brandTypes.retailer") },
    { value: "service", label: t("brandTypes.service") },
    { value: "financial", label: t("brandTypes.financial") },
    { value: "platform", label: t("brandTypes.platform") },
    { value: "local", label: t("brandTypes.local") },
    { value: "publisher", label: t("brandTypes.publisher") },
    { value: "pharma", label: t("brandTypes.pharma") },
    { value: "utility", label: t("brandTypes.utility") },
    { value: "altro", label: t("brandTypes.other") },
  ];

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setExistingProjectCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setExistingProjectCount(0));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => setIsPro(p?.plan === "pro" || p?.plan === "agency"))
      .catch(() => {});
  }, []);

  const [name, setName] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [sector, setSector] = useState("");
  const [customSector, setCustomSector] = useState("");
  const [brandType, setBrandType] = useState("manufacturer");
  const [customBrandType, setCustomBrandType] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set(["openai"]));
  const [selectedModelPerProvider, setSelectedModelPerProvider] = useState<Record<string, string>>({
    openai: "gpt-4o-mini",
  });

  const modelLimit = isPro ? Infinity : BASE_MODEL_LIMIT;
  const atLimit = !isPro && activeProviders.size >= modelLimit;

  function toggleProvider(provider: ProviderOption) {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider.id)) {
        next.delete(provider.id);
        setSelectedModelPerProvider((m) => {
          const copy = { ...m };
          delete copy[provider.id];
          return copy;
        });
      } else {
        if (!isPro && next.size >= BASE_MODEL_LIMIT) return prev;
        next.add(provider.id);
        if (!selectedModelPerProvider[provider.id]) {
          setSelectedModelPerProvider((m) => ({ ...m, [provider.id]: provider.models[0].id }));
        }
      }
      return next;
    });
  }

  function selectModel(providerId: string, modelId: string) {
    const currentModel = selectedModelPerProvider[providerId];
    if (currentModel === modelId) {
      setActiveProviders((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
      setSelectedModelPerProvider((prev) => {
        const copy = { ...prev };
        delete copy[providerId];
        return copy;
      });
    } else {
      setSelectedModelPerProvider((prev) => ({ ...prev, [providerId]: modelId }));
    }
  }

  function getModelsConfig(): string[] {
    return AVAILABLE_PROVIDERS
      .filter((p) => activeProviders.has(p.id))
      .map((p) => selectedModelPerProvider[p.id] ?? p.models[0].id);
  }

  function handleCompetitorKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = competitorInput.trim();
    if (value && !competitors.includes(value)) {
      setCompetitors([...competitors, value]);
    }
    setCompetitorInput("");
  }

  function removeCompetitor(name: string) {
    setCompetitors(competitors.filter((c) => c !== name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeProviders.size === 0) {
      setError(t("projects.selectAtLeastOne"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          target_brand: targetBrand,
          sector: sector === "Altro" ? (customSector || "Altro") : (sector || null),
          brand_type: brandType === "altro" ? (customBrandType || "altro") : brandType,
          website_url: websiteUrl || null,
          known_competitors: competitors,
          market_context: marketContext || null,
          language,
          country: countries.length > 0 ? countries.join(", ") : null,
          models_config: getModelsConfig(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("projects.saveError"));
      }

      if (existingProjectCount === 0) {
        setNewProjectId(data.id);
        setShowPlanSelector(true);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#00d4ff", "#7eb3d4", "#e8956d", "#7eb89a", "#c4a882"],
        });
        return;
      }

      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          {t("projects.backToProjects")}
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("projects.newProjectTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("projects.newProjectSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA" && (e.target as HTMLElement).getAttribute("type") !== "submit") e.preventDefault(); }} className="card p-6 space-y-5">
        {/* Nome progetto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.projectName")}</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t("projects.projectNamePlaceholder")} className="input-base" />
        </div>

        {/* Brand rilevato */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.targetBrand")}
            <InfoTooltip text={t("projects.targetBrandTooltip")} />
          </label>
          <input type="text" required value={targetBrand} onChange={(e) => setTargetBrand(e.target.value)}
            placeholder={t("projects.targetBrandPlaceholder")} className="input-base" />
        </div>

        {/* Settore e Tipo Brand */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("projects.sector")}
              <InfoTooltip text={t("projects.sectorTooltip")} />
            </label>
            <select value={sector} onChange={(e) => { setSector(e.target.value); if (e.target.value !== "Altro") setCustomSector(""); }} className="input-base">
              <option value="">{t("projects.selectSector")}</option>
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {sector === "Altro" && (
              <input type="text" value={customSector} onChange={(e) => setCustomSector(e.target.value)}
                placeholder={t("projects.selectSector")} className="input-base mt-1.5" />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("projects.brandType")}
              <InfoTooltip text={t("projects.brandTypeTooltip")} />
            </label>
            <select value={brandType} onChange={(e) => { setBrandType(e.target.value); if (e.target.value !== "altro") setCustomBrandType(""); }} className="input-base">
              {BRAND_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
            {brandType === "altro" && (
              <input type="text" value={customBrandType} onChange={(e) => setCustomBrandType(e.target.value)}
                placeholder={t("projects.brandType")} className="input-base mt-1.5" />
            )}
          </div>
        </div>

        {/* Sito web */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {t("projects.website")}
            <InfoTooltip text={t("projects.websiteTooltip")} />
          </label>
          <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder={t("projects.websitePlaceholder")} className="input-base" />
        </div>

        {/* Competitor */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.knownCompetitors")}</label>
          <input type="text" value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)}
            onKeyDown={handleCompetitorKeyDown} placeholder={t("projects.competitorPlaceholder")} className="input-base" />
          {competitors.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {competitors.map((c) => (
                <span key={c} className="badge badge-primary flex items-center gap-1">
                  {c}
                  <button type="button" onClick={() => removeCompetitor(c)} className="hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contesto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.marketContext")}</label>
          <textarea value={marketContext} onChange={(e) => setMarketContext(e.target.value)}
            placeholder={t("projects.marketContextPlaceholder")} rows={4} className="input-base resize-none" />
        </div>

        {/* Lingua e Paese */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("projects.language")}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as "it" | "en")} className="input-base">
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("projects.country")}
              <InfoTooltip text={t("projects.countryTooltip")} />
            </label>
            <div ref={countryRef} className="relative">
              <button type="button" onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className="input-base w-full flex items-center justify-between text-left">
                <span className={countries.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                  {countries.length > 0 ? `${countries.length} ${countries.length === 1 ? t("projects.selected") : t("projects.selectedPlural")}` : t("projects.selectCountries")}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {countries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {countries.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border border-primary/30 bg-primary/5 text-foreground">
                      {c}
                      <button type="button" onClick={() => setCountries(countries.filter((x) => x !== c))} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {countryDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-[#111416] border border-border rounded-[2px] shadow-xl max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2 input-base">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input type="text" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder={t("projects.searchCountry")}
                        className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground flex-1" autoFocus />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-44">
                    {filteredCountries.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">{t("common.noResults")}</p>
                    ) : (
                      filteredCountries.map((c) => {
                        const isSelected = countries.includes(c);
                        return (
                          <button key={c} type="button"
                            onClick={() => { setCountries(isSelected ? countries.filter((x) => x !== c) : [...countries, c]); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                              isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/30"
                            }`}>
                            <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            {c}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modelli AI */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("projects.aiModels")}</label>
          <p className="text-xs text-muted-foreground">
            {t("projects.selectProviderModel")}
            {!isPro && ` (${t("projects.maxModels").replace("{n}", String(BASE_MODEL_LIMIT))})`}
          </p>
          <div className="space-y-2">
            {AVAILABLE_PROVIDERS.map((provider) => {
              const isSoon = !!provider.comingSoon;
              const isActive = !isSoon && activeProviders.has(provider.id);
              const currentModel = selectedModelPerProvider[provider.id] ?? provider.models[0].id;
              const isDisabled = isSoon || (!isActive && atLimit);

              return (
                <div key={provider.id}
                  className={`rounded-sm border transition-all ${
                    isSoon ? "border-border opacity-50"
                      : isActive ? "border-primary/50 bg-primary/5"
                      : isDisabled ? "border-border opacity-40"
                      : "border-border"
                  }`}>
                  <button type="button" onClick={() => !isDisabled && toggleProvider(provider)} disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                      isActive ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isActive && (
                        <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${isSoon ? "text-muted-foreground" : "text-foreground"}`}>{provider.label}</span>
                    <span className="font-mono text-[0.69rem] tracking-wide text-muted-foreground">{provider.badge}</span>
                    {isSoon && (
                      <span className="font-mono text-[0.69rem] tracking-wide text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] ml-auto">SOON</span>
                    )}
                  </button>

                  {isActive && (
                    <div className="px-4 pb-3 pt-0 space-y-0.5">
                      {provider.models.map((model) => {
                        const isSelected = currentModel === model.id;
                        return (
                          <label key={model.id} onClick={() => selectModel(provider.id, model.id)}
                            className={`flex items-center gap-2 p-2 rounded-[2px] cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/10" : "hover:bg-muted/30"
                            }`}>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? "border-primary" : "border-muted-foreground"
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{model.label}</span>
                              <p className="text-xs text-muted-foreground">{model.description}</p>
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

          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{t("projects.modelsFixed")}</p>
            </div>
            <p className="text-xs text-muted-foreground shrink-0 ml-4">
              <span className="text-foreground font-bold">{activeProviders.size}</span>
              {isPro ? ` ${t("projects.modelsSelected")}` : ` / ${BASE_MODEL_LIMIT} ${t("projects.modelsOf")}`}
            </p>
          </div>

          {atLimit && (
            <p className="text-xs text-[#c4a882]">
              {t("projects.modelLimitReached").replace("{n}", String(BASE_MODEL_LIMIT))}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading || activeProviders.size === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? t("common.saving") : t("projects.createProject")}
        </button>
      </form>

      {/* Plan selector */}
      {showPlanSelector && newProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl bg-[#111416] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-8 py-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display font-bold text-2xl text-foreground">{t("projects.choosePlan")}</h2>
                <p className="text-sm text-muted-foreground">{t("projects.startFreeOrPro")}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Starter */}
                <div className="rounded-lg border border-border p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">{t("settings.baseStarter")}</h3>
                    <p className="text-2xl font-bold text-foreground mt-1">{t("settings.free")}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" />100 {t("settings.queriesMonth")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" />{t("settings.maxProjects").replace("{n}", "3")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" />{t("settings.maxModels").replace("{n}", "3")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" />{t("settings.basicAvi")}</li>
                  </ul>
                  <button onClick={() => { router.push(`/projects/${newProjectId}`); router.refresh(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border text-foreground rounded-[2px] text-sm font-semibold hover:bg-surface-2 transition-colors">
                    {t("projects.startFree")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Pro */}
                <div className="rounded-lg border border-[#c4a882]/30 bg-[#c4a882]/5 p-6 space-y-4 relative">
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 font-mono text-[0.75rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1.5 py-0.5 rounded-[2px]">
                      <Crown className="w-3 h-3" /> PRO
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-foreground">Pro</h3>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      &euro;29<span className="text-sm font-normal text-muted-foreground">/mese</span>
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />500 {t("settings.queriesMonth")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />{t("settings.maxProjects").replace("{n}", "10")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />{t("settings.allModelsUnlocked")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />10 {t("settings.compareDetections")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />{t("settings.generatePromptAI")}</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#c4a882] shrink-0" />{t("settings.datasetPlusAvi")}</li>
                  </ul>
                  <button onClick={() => { router.push("/settings#piano"); router.refresh(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c4a882] text-black rounded-[2px] text-sm font-semibold hover:bg-[#c4a882]/80 transition-colors">
                    <Crown className="w-4 h-4" />
                    {t("projects.goToPro")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

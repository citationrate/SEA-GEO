"use client";

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, X, Loader2, Lock, Check, Search, ChevronDown, Globe, Sparkles } from "lucide-react";
import { PROVIDER_GROUPS, DEMO_MODEL_IDS } from "@citationrate/llm-client";
import { getEffectivePlanId } from "@/lib/utils/is-pro";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

interface ModelOption {
  id: string;
  label: string;
  description: string;
  expensive?: boolean;
  proOnly?: boolean;
}

interface ProviderOption {
  id: string;
  label: string;
  badge: string;
  color: string;
  models: ModelOption[];
  comingSoon?: boolean;
}

const COUNTRY_CODES = [
  "GLOBAL",
  "AF","AL","DZ","AD","AO","AG","SA","AR","AM","AU","AT","AZ",
  "BS","BH","BD","BB","BE","BZ","BJ","BT","BY","BO","BA","BW","BR","BN","BG","BF","BI",
  "KH","CM","CA","CV","TD","CL","CN","CY","CO","KM","KP","KR","CI","CR","HR","CU",
  "DK","DM",
  "EC","EG","SV","AE","ER","EE","SZ","ET",
  "FJ","PH","FI","FR",
  "GA","GM","GE","DE","GH","JM","JP","DJ","JO","GR","GD","GT","GN","GQ","GW","GY",
  "HT","HN",
  "IN","ID","IR","IQ","IE","IS","IL","IT",
  "KZ","KE","KG","KI","KW",
  "LA","LS","LV","LB","LR","LY","LI","LT","LU",
  "MK","MG","MW","MY","MV","ML","MT","MA","MR","MU","MX","FM","MD","MC","MN","ME","MZ","MM",
  "NA","NR","NP","NI","NE","NG","NO","NZ",
  "OM",
  "NL","PK","PW","PS","PA","PG","PY","PE","PL","PT",
  "QA",
  "GB","CZ","CF","CG","CD","DO","RO","RW","RU",
  "KN","LC","VC","WS","SM","ST","SN","RS","SC","SL","SG","SY","SK","SI","SO","ES","LK","US","ZA","SD","SS","SR","SE","CH",
  "TJ","TW","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV",
  "UA","UG","HU","UY","UZ",
  "VU","VA","VE","VN",
  "YE",
  "ZM","ZW"
];

const BASE_MODEL_LIMIT = 3;

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();

  const localeMap: Record<string, string> = { it: "it", en: "en", fr: "fr", de: "de", es: "es" };
  const displayNames = new Intl.DisplayNames([localeMap[locale] || "it"], { type: "region" });

  const COUNTRIES = COUNTRY_CODES.map(code => {
    if (code === "GLOBAL") return locale === "it" ? "Globale / Worldwide" : locale === "en" ? "Global / Worldwide" : locale === "fr" ? "Mondial / Worldwide" : locale === "de" ? "Global / Weltweit" : "Global / Mundial";
    try { return displayNames.of(code) || code; } catch { return code; }
  }).sort((a, b) => {
    if (a.startsWith("Global") || a.startsWith("Mondial")) return -1;
    if (b.startsWith("Global") || b.startsWith("Mondial")) return 1;
    return a.localeCompare(b, localeMap[locale] || "it");
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingProjectCount, setExistingProjectCount] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [planId, setPlanId] = useState<"demo" | "base" | "pro" | "enterprise">("demo");

  const AVAILABLE_PROVIDERS: ProviderOption[] = PROVIDER_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    badge: g.badge,
    color: g.color,
    comingSoon: g.comingSoon,
    models: g.models.map((m) => ({
      id: m.id,
      label: m.label,
      description: t(m.descriptionKey),
      expensive: m.expensive,
      proOnly: m.proOnly,
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
      .then((p) => {
        const ePlan = getEffectivePlanId(p?.plan);
        setPlanId(ePlan);
        setIsPro(ePlan === "pro" || ePlan === "enterprise");
      })
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
  const LANG_OPTIONS = [
    { value: "it", label: "🇮🇹 Italiano" },
    { value: "en", label: "🇬🇧 English" },
    { value: "fr", label: "🇫🇷 Français" },
    { value: "de", label: "🇩🇪 Deutsch" },
    { value: "es", label: "🇪🇸 Español" },
  ] as const;
  type DetectionLang = typeof LANG_OPTIONS[number]["value"];
  const [language, setLanguage] = useState<DetectionLang>(() => {
    if (typeof navigator !== "undefined") {
      const browserLang = navigator.language?.slice(0, 2) as DetectionLang;
      if (LANG_OPTIONS.some((l) => l.value === browserLang)) return browserLang;
    }
    return "it";
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  // Site analysis
  const [siteAnalysis, setSiteAnalysis] = useState<any>(null);
  const [siteAnalysisLoading, setSiteAnalysisLoading] = useState(false);
  const [siteAnalysisError, setSiteAnalysisError] = useState("");
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<string[]>([]);
  const analyzedUrlRef = useRef("");

  const analyzeSite = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.length < 5) return;
    if (analyzedUrlRef.current === trimmed) return;
    analyzedUrlRef.current = trimmed;

    setSiteAnalysisLoading(true);
    setSiteAnalysisError("");
    setSiteAnalysis(null);
    setSuggestedCompetitors([]);
    try {
      const res = await fetch("/api/projects/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, language }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSiteAnalysisError(data.error || t("projects.siteAnalysisError"));
        return;
      }
      const { analysis } = await res.json();
      setSiteAnalysis(analysis);

      // Expose competitor_signals as opt-in suggestions (not auto-applied to the form)
      if (Array.isArray(analysis.competitor_signals) && analysis.competitor_signals.length > 0) {
        setSuggestedCompetitors((prev) => {
          const already = new Set([...competitors, ...prev]);
          const fresh = analysis.competitor_signals.filter((c: string) => c && !already.has(c));
          return [...prev, ...fresh].slice(0, 5);
        });
      }
    } catch {
      setSiteAnalysisError(t("projects.siteAnalysisError"));
    } finally {
      setSiteAnalysisLoading(false);
    }
  }, [competitors, language, t]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Prefill from query string — used by the CS→AVI bridge on the suite audit
  // detail page ("misura l'impatto dei fix"). Runs once on mount.
  // We intentionally skip `sector`: the CS 15-sector taxonomy doesn't map 1:1
  // to AVI's 10 sectors, so the user picks it here.
  useEffect(() => {
    const brandParam = searchParams.get("brand")?.trim();
    const urlParam = searchParams.get("url")?.trim();
    if (brandParam) {
      setTargetBrand(brandParam);
      setName(brandParam);
    }
    if (urlParam) {
      setWebsiteUrl(urlParam);
      analyzeSite(urlParam);
    }
    // Depend only on search params — analyzeSite is stable enough for this
    // one-shot prefill and including it triggers a re-run on competitor edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set(["openai"]));
  const [selectedModelPerProvider, setSelectedModelPerProvider] = useState<Record<string, string>>({
    openai: "gpt-5.4-mini",
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
    if (planId === "demo") return [...DEMO_MODEL_IDS];
    return AVAILABLE_PROVIDERS
      .filter((p) => activeProviders.has(p.id))
      .map((p) => selectedModelPerProvider[p.id] ?? p.models[0].id);
  }

  function addCompetitorsFromRaw(raw: string) {
    const names = raw.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s && !competitors.includes(s));
    if (names.length > 0) {
      setCompetitors((prev) => [...prev, ...names]);
    }
    setCompetitorInput("");
  }

  function handleCompetitorKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    addCompetitorsFromRaw(competitorInput);
  }

  function removeCompetitor(name: string) {
    setCompetitors(competitors.filter((c) => c !== name));
  }

  function acceptSuggestedCompetitor(name: string) {
    setCompetitors((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSuggestedCompetitors((prev) => prev.filter((s) => s !== name));
  }

  function dismissAllSuggestions() {
    setSuggestedCompetitors([]);
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
          site_analysis: siteAnalysis || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("projects.saveError"));
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

        {/* Lingua di rilevazione */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-primary" />
            {t("projects.detectionLanguage")}
            <InfoTooltip text={t("projects.detectionLanguageTooltip")} />
          </label>
          <select
            value={language}
            onChange={(e) => {
              const val = e.target.value as DetectionLang;
              setLanguage(val);
              if (websiteUrl.trim().length >= 5) { analyzedUrlRef.current = ""; analyzeSite(websiteUrl); }
            }}
            className="input-base w-full"
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Settore e Tipo Brand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="relative">
            <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => analyzeSite(websiteUrl)}
              placeholder={t("projects.websitePlaceholder")} className="input-base" />
          </div>
          {siteAnalysisLoading && (
            <div className="flex items-center gap-3 rounded-[2px] border border-primary/30 bg-primary/5 px-4 py-3 animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("projects.analyzingSite")}</p>
                <p className="text-xs text-muted-foreground">{t("projects.analyzingSiteDesc")}</p>
              </div>
            </div>
          )}
          {siteAnalysisError && (
            <p className="text-xs text-muted-foreground">{siteAnalysisError}</p>
          )}
        </div>

        {/* Site analysis results — titles follow detection language, not UI language */}
        {siteAnalysis && (() => {
          const labelsByLang: Record<string, { analyzed: string; service: string; audience: string; value: string; tone: string; geo: string; keywords: string }> = {
            it: { analyzed: "Abbiamo analizzato il tuo sito", service: "Servizio rilevato", audience: "Pubblico target", value: "Proposta di valore", tone: "Tono", geo: "Copertura", keywords: "Parole chiave settore" },
            en: { analyzed: "We analyzed your website", service: "Detected service", audience: "Target audience", value: "Value proposition", tone: "Tone", geo: "Coverage", keywords: "Sector keywords" },
            fr: { analyzed: "Nous avons analys\u00e9 votre site", service: "Service d\u00e9tect\u00e9", audience: "Public cible", value: "Proposition de valeur", tone: "Ton", geo: "Couverture", keywords: "Mots-cl\u00e9s secteur" },
            de: { analyzed: "Wir haben Ihre Website analysiert", service: "Erkannter Service", audience: "Zielgruppe", value: "Wertversprechen", tone: "Tonfall", geo: "Abdeckung", keywords: "Branchenschl\u00fcsselw\u00f6rter" },
            es: { analyzed: "Hemos analizado tu sitio", service: "Servicio detectado", audience: "P\u00fablico objetivo", value: "Propuesta de valor", tone: "Tono", geo: "Cobertura", keywords: "Palabras clave del sector" },
          };
          const labels = labelsByLang[language] ?? labelsByLang.en;
          return (
          <div className="rounded-[2px] border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{labels.analyzed}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {siteAnalysis.main_service && (
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">{labels.service}</p>
                  <p className="text-foreground">{siteAnalysis.main_service}</p>
                </div>
              )}
              {siteAnalysis.target_audience && (
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">{labels.audience}</p>
                  <p className="text-foreground">{siteAnalysis.target_audience}</p>
                </div>
              )}
              {siteAnalysis.value_proposition && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">{labels.value}</p>
                  <p className="text-foreground">{siteAnalysis.value_proposition}</p>
                </div>
              )}
              {siteAnalysis.tone && (
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">{labels.tone}</p>
                  <p className="text-foreground capitalize">{siteAnalysis.tone}</p>
                </div>
              )}
              {siteAnalysis.geography && (
                <div>
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">{labels.geo}</p>
                  <p className="text-foreground capitalize">{siteAnalysis.geography}</p>
                </div>
              )}
              {siteAnalysis.sector_keywords?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground uppercase tracking-wide font-semibold mb-1">{labels.keywords}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {siteAnalysis.sector_keywords.map((kw: string) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full text-[0.6875rem] font-medium border border-primary/20 bg-primary/5 text-foreground">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* Competitor */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.knownCompetitors")}</label>
          <input type="text" value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)}
            onKeyDown={handleCompetitorKeyDown}
            onBlur={() => { if (competitorInput.trim()) addCompetitorsFromRaw(competitorInput); }}
            onPaste={(e) => { const text = e.clipboardData?.getData("text"); if (text && (text.includes(",") || text.includes(";"))) { e.preventDefault(); addCompetitorsFromRaw(text); } }}
            placeholder={t("projects.competitorPlaceholder")} className="input-base" />
          <p className="text-xs text-muted-foreground mt-1">{t("projects.competitorHint")}</p>
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
          {suggestedCompetitors.length > 0 && (
            <div className="mt-3 rounded-[2px] border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-foreground truncate">{t("projects.suggestedCompetitorsTitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={dismissAllSuggestions}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {t("projects.suggestionsDismissAll")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t("projects.suggestedCompetitorsHint")}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedCompetitors.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => acceptSuggestedCompetitor(name)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-primary/30 bg-transparent text-foreground hover:bg-primary/10 transition-colors"
                  >
                    <span aria-hidden>+</span>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contesto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">{t("projects.marketContext")}</label>
          <textarea value={marketContext} onChange={(e) => setMarketContext(e.target.value)}
            placeholder={t("projects.marketContextPlaceholder")} rows={4} className="input-base resize-none" />
        </div>

        {/* Paese */}
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

        {/* Modelli AI */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("projects.aiModels")}</label>

          {/* Demo plan: fixed models, not selectable */}
          {planId === "demo" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("projects.demoModelsDesc")}
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_MODEL_IDS.map((modelId) => (
                  <span key={modelId} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
                    <Check className="w-3.5 h-3.5 text-primary" />
                    {modelId === "gpt-5.4-mini" ? "GPT-5.4 Mini" : "Gemini 2.5 Flash"}
                  </span>
                ))}
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{t("projects.modelsFixed")}</p>
              </div>
            </div>
          ) : (
            <>
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
                        <span className={`text-sm font-semibold ${isSoon ? "text-muted-foreground" : provider.color}`}>{provider.label}</span>
                        <span className="font-mono text-[0.69rem] tracking-wide text-muted-foreground">{provider.badge}</span>
                        {isSoon && (
                          <span className="font-mono text-[0.69rem] tracking-wide text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-[2px] ml-auto">SOON</span>
                        )}
                      </button>

                      {isActive && (
                        <div className="px-4 pb-3 pt-0 space-y-0.5">
                          {provider.models.map((model) => {
                            const isSelected = currentModel === model.id;
                            const locked = model.proOnly && !isPro;
                            return (
                              <label key={model.id} onClick={() => !locked && selectModel(provider.id, model.id)}
                                className={`flex items-center gap-2 p-2 rounded-[2px] transition-colors ${
                                  locked ? "opacity-70 cursor-not-allowed" : isSelected ? "bg-primary/10 cursor-pointer" : "hover:bg-muted/30 cursor-pointer"
                                }`}
                                title={locked ? `${t("compare.proOnly")} — €159${t("piano.perMonth")} ${t("piano.plusVat")}` : undefined}>
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  locked ? "border-muted-foreground/40" : isSelected ? "border-primary" : "border-muted-foreground"
                                }`}>
                                  {isSelected && !locked && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-medium ${locked ? "text-muted-foreground" : isSelected ? "text-primary" : "text-foreground"}`}>{model.label}</span>
                                    {locked && <span className="font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">PRO</span>}
                                  </div>
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
            </>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading || (planId !== "demo" && activeProviders.size === 0)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? t("common.saving") : t("projects.createProject")}
        </button>
      </form>

    </div>
  );
}

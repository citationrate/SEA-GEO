// v4
"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { SuggestedQueriesNew, type SuggestedQuery } from "@/components/suggested-queries";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

interface ProviderOption {
  id: string;
  label: string;
  comingSoon?: boolean;
  models: ModelOption[];
}

const AVAILABLE_PROVIDERS: ProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Veloce, risposte concise" },
      { id: "gpt-4o", label: "GPT-4o", description: "Preciso, risposte elaborate" },
      { id: "o1-mini", label: "o1 Mini", description: "Ragionamento approfondito" },
    ],
  },
  {
    id: "google",
    label: "Google",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Veloce, aggiornato" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Massima precisione" },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    models: [
      { id: "perplexity-sonar", label: "Sonar", description: "Web search in tempo reale" },
      { id: "perplexity-sonar-pro", label: "Sonar Pro", description: "Web search avanzato, fonti più ricche" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-haiku", label: "Claude Haiku 4.5", description: "Veloce e diretto" },
      { id: "claude-sonnet", label: "Claude Sonnet 4.5", description: "Bilanciato e preciso" },
      { id: "claude-opus", label: "Claude Opus 4.5", description: "Massima qualità" },
    ],
  },
  {
    id: "xai",
    label: "xAI",
    models: [
      { id: "grok-3", label: "Grok 3", description: "Preciso e aggiornato" },
      { id: "grok-3-mini", label: "Grok 3 Mini", description: "Veloce e diretto" },
    ],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    comingSoon: true,
    models: [
      { id: "copilot-gpt4", label: "Copilot GPT-4", description: "Prossimamente disponibile" },
    ],
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [sector, setSector] = useState("");
  const [brandType, setBrandType] = useState("manufacturer");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [country, setCountry] = useState("");
  const [selectedQueries, setSelectedQueries] = useState<SuggestedQuery[]>([]);

  // Track which providers are active and which model is selected per provider
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set(["openai"]));
  const [selectedModelPerProvider, setSelectedModelPerProvider] = useState<Record<string, string>>({
    openai: "gpt-4o-mini",
  });

  function toggleProvider(provider: ProviderOption) {
    if (provider.comingSoon) return;
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider.id)) {
        if (next.size === 1) return prev; // minimo 1 provider
        next.delete(provider.id);
      } else {
        next.add(provider.id);
        // Set default model if none selected
        if (!selectedModelPerProvider[provider.id]) {
          setSelectedModelPerProvider((m) => ({ ...m, [provider.id]: provider.models[0].id }));
        }
      }
      return next;
    });
  }

  function selectModel(providerId: string, modelId: string) {
    setSelectedModelPerProvider((prev) => ({ ...prev, [providerId]: modelId }));
  }

  // Build models_config array from active providers
  function getModelsConfig(): string[] {
    return AVAILABLE_PROVIDERS
      .filter((p) => activeProviders.has(p.id) && !p.comingSoon)
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
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          target_brand: targetBrand,
          sector: sector || null,
          brand_type: brandType,
          website_url: websiteUrl || null,
          known_competitors: competitors,
          market_context: marketContext || null,
          language,
          country: country || null,
          models_config: getModelsConfig(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante il salvataggio");
      }

      // Save selected suggested queries
      if (selectedQueries.length > 0 && data.id) {
        await Promise.all(
          selectedQueries.map((q) =>
            fetch("/api/queries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: data.id, text: q.text, funnel_stage: q.stage }),
            })
          )
        );
      }

      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai progetti
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">Nuovo Progetto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura il brand e il contesto di mercato per l&apos;analisi AI
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Nome progetto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nome progetto</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Analisi Brand 2026"
            className="input-base"
          />
        </div>

        {/* Brand target */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            Brand target
            <InfoTooltip text="Il brand che verrà cercato nelle risposte AI" />
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

        {/* Settore e Tipo Brand */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Settore
              <InfoTooltip text="Usato per suggerire query rilevanti per il tuo mercato" />
            </label>
            <select
              value={sector}
              onChange={(e) => { setSector(e.target.value); setSelectedQueries([]); }}
              className="input-base"
            >
              <option value="">Seleziona...</option>
              {["Turismo", "Alimentare", "Bevande", "Tech", "Moda", "Finance", "Automotive", "Pharma", "Energia", "Altro"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Tipo Brand
              <InfoTooltip text="Aiuta l'AI a classificare correttamente i competitor" />
            </label>
            <select
              value={brandType}
              onChange={(e) => setBrandType(e.target.value)}
              className="input-base"
            >
              <option value="manufacturer">Produttore / Brand</option>
              <option value="retailer">Retailer / GDO</option>
              <option value="service">Servizio / Subscription</option>
              <option value="financial">Finanziario / Assicurativo</option>
              <option value="platform">Piattaforma / Marketplace</option>
              <option value="local">Business Locale / Catena</option>
              <option value="publisher">Media / Editore / Publisher</option>
              <option value="pharma">Pharma / Healthcare</option>
              <option value="utility">Utility / Energia / Telco</option>
            </select>
          </div>
        </div>

        {/* Query suggerite per settore */}
        {sector && (
          <SuggestedQueriesNew
            sector={sector}
            selectedQueries={selectedQueries}
            onSelectionChange={setSelectedQueries}
          />
        )}

        {/* Sito web ufficiale */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            Sito web ufficiale
            <InfoTooltip text="Usato per rilevare le fonti owned nei risultati" />
          </label>
          <input
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Es. lumora.it"
            className="input-base"
          />
        </div>

        {/* Competitor conosciuti */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Competitor conosciuti</label>
          <input
            type="text"
            value={competitorInput}
            onChange={(e) => setCompetitorInput(e.target.value)}
            onKeyDown={handleCompetitorKeyDown}
            placeholder="Scrivi un nome e premi Invio"
            className="input-base"
          />
          {competitors.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {competitors.map((c) => (
                <span key={c} className="badge badge-primary flex items-center gap-1">
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCompetitor(c)}
                    className="hover:text-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contesto di mercato */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contesto di mercato</label>
          <textarea
            value={marketContext}
            onChange={(e) => setMarketContext(e.target.value)}
            placeholder="Descrivi il settore, il posizionamento e il pubblico target..."
            rows={4}
            className="input-base resize-none"
          />
        </div>

        {/* Lingua e Paese */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Lingua</label>
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
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Paese
              <InfoTooltip text="Determina la lingua e il contesto geografico dell'analisi" />
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Es. Italia"
              className="input-base"
            />
          </div>
        </div>

        {/* Modelli AI - Two-level provider → model */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Modelli AI</label>
          <p className="text-xs text-muted-foreground">Seleziona i provider e il modello specifico per ogni analisi (minimo 1)</p>
          <div className="space-y-2">
            {AVAILABLE_PROVIDERS.map((provider) => {
              const isActive = activeProviders.has(provider.id);
              const isDisabled = !!provider.comingSoon;
              const currentModel = selectedModelPerProvider[provider.id] ?? provider.models[0].id;

              return (
                <div
                  key={provider.id}
                  className={`rounded-sm border transition-all ${
                    isDisabled
                      ? "opacity-50 cursor-not-allowed border-border"
                      : isActive
                        ? "border-primary/50 bg-primary/5"
                        : "border-border"
                  }`}
                >
                  {/* Provider header */}
                  <button
                    type="button"
                    onClick={() => toggleProvider(provider)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                      isActive && !isDisabled ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isActive && !isDisabled && (
                        <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{provider.label}</span>
                    <span className="font-mono text-[0.55rem] tracking-wide text-muted-foreground">{provider.id.toUpperCase()}</span>
                    {provider.comingSoon && (
                      <span className="font-mono text-[0.55rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1.5 py-0.5 rounded-[2px]">SOON</span>
                    )}
                  </button>

                  {/* Model radio buttons */}
                  {isActive && !isDisabled && (
                    <div className="px-4 pb-3 pt-0 space-y-0.5">
                      {provider.models.map((model) => (
                        <label
                          key={model.id}
                          onClick={() => selectModel(provider.id, model.id)}
                          className={`flex items-center gap-2 p-2 rounded-[2px] cursor-pointer transition-colors ${
                            currentModel === model.id
                              ? "bg-primary/10"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            currentModel === model.id ? "border-primary" : "border-muted-foreground"
                          }`}>
                            {currentModel === model.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${
                              currentModel === model.id ? "text-primary" : "text-foreground"
                            }`}>{model.label}</span>
                            <p className="text-xs text-muted-foreground">{model.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Salvataggio..." : "Crea Progetto"}
        </button>
      </form>
    </div>
  );
}

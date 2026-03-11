// v3
"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Loader2 } from "lucide-react";

const MODEL_OPTIONS = [
  { id: "gpt-4o-mini",   label: "GPT-4o Mini",        provider: "OpenAI",     description: "Veloce ed economico",         available: true },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google",    description: "Richiede billing attivo",     available: true },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "Anthropic", description: "Veloce e preciso", available: true },
  { id: "perplexity-sonar", label: "Sonar Large",      provider: "Perplexity", description: "Con web search nativo",      available: true },
  { id: "copilot-gpt4",  label: "Copilot GPT-4",       provider: "Microsoft",  description: "Via Azure OpenAI",           available: true },
  { id: "grok-3",        label: "Grok 3",              provider: "xAI",        description: "Modello xAI",                available: true },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [country, setCountry] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>(["gpt-4o-mini"]);

  function toggleModel(id: string) {
    setSelectedModels((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // minimo 1
        return prev.filter((m) => m !== id);
      }
      return [...prev, id];
    });
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
          website_url: websiteUrl || null,
          known_competitors: competitors,
          market_context: marketContext || null,
          language,
          country: country || null,
          models_config: selectedModels,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante il salvataggio");
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
          <label className="text-sm font-medium text-foreground">Brand target</label>
          <input
            type="text"
            required
            value={targetBrand}
            onChange={(e) => setTargetBrand(e.target.value)}
            placeholder="Es. Acme Inc"
            className="input-base"
          />
        </div>

        {/* Sito web ufficiale */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Sito web ufficiale</label>
          <input
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Es. lavazza.it"
            className="input-base"
          />
          <p className="text-xs text-muted-foreground">Dominio del brand per identificare le fonti di proprieta</p>
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
            <label className="text-sm font-medium text-foreground">Paese</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Es. Italia"
              className="input-base"
            />
          </div>
        </div>

        {/* Modelli AI */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Modelli AI</label>
          <p className="text-xs text-muted-foreground">Seleziona i modelli da usare per tutte le analisi di questo progetto (minimo 1)</p>
          <div className="space-y-1.5">
            {MODEL_OPTIONS.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => model.available && toggleModel(model.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-all text-left ${
                  selectedModels.includes(model.id)
                    ? "border-primary/50 bg-primary/10"
                    : "border-border hover:border-border/80"
                } ${!model.available ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                  selectedModels.includes(model.id) ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {selectedModels.includes(model.id) && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{model.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">{model.provider}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                </div>
              </button>
            ))}
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

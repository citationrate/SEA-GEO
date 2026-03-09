// v2
"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Loader2 } from "lucide-react";

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

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Salvataggio..." : "Crea Progetto"}
        </button>
      </form>
    </div>
  );
}

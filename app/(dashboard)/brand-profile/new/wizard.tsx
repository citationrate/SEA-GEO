"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const COUNTRIES = ["IT", "US", "GB", "ES", "FR", "DE"] as const;
const LOCALES = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
] as const;

const AVAILABLE_MODELS = [
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "claude-haiku", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet", label: "Claude Sonnet 4.6" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "perplexity-sonar", label: "Perplexity Sonar" },
  { id: "grok-3-mini", label: "Grok 3 Mini" },
] as const;

export function BrandProfileWizard({
  plan,
  modelCap,
  remaining,
  runLimit,
}: {
  plan: string;
  modelCap: number;
  remaining: number;
  runLimit: number;
}) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>("IT");
  const [locale, setLocale] = useState<string>("it");
  const [models, setModels] = useState<string[]>(["claude-haiku"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleModel(id: string) {
    setModels((curr) => {
      if (curr.includes(id)) return curr.filter((m) => m !== id);
      if (curr.length >= modelCap) return curr;
      return [...curr, id];
    });
  }

  async function submit() {
    setError(null);
    if (brand.trim().length < 2) return setError("Inserisci il nome del brand.");
    if (sector.trim().length < 2) return setError("Inserisci il settore.");
    if (models.length === 0) return setError("Seleziona almeno un modello AI.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/brand-profile/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          brand_url: brandUrl.trim() || null,
          sector: sector.trim(),
          country,
          locale,
          models,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Errore sconosciuto");
        setSubmitting(false);
        return;
      }
      router.push(`/brand-profile/${json.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di rete");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/brand-profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" />
            Torna alle run
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            Nuova run Brand Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            15 prompt × 5 pilastri (Recognition, Clarity, Authority, Relevance, Sentiment).
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <div className="uppercase tracking-wide">Run residue</div>
          <div className="text-sm font-display font-semibold text-foreground">
            {runLimit >= 999 ? "Illimitate" : `${remaining} / ${runLimit}`}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand *</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Es. Citation Rate"
              maxLength={120}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL dominio (opzionale)</label>
            <input
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              placeholder="https://esempio.com"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Settore *</label>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Es. SaaS AI Visibility & SEO Tools"
            maxLength={120}
            className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paese</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as typeof country)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lingua prompt</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Modelli AI (max {modelCap})
            </label>
            <span className="text-xs text-muted-foreground">{models.length} / {modelCap} selezionati</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {AVAILABLE_MODELS.map((m) => {
              const selected = models.includes(m.id);
              const disabled = !selected && models.length >= modelCap;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-[2px] border text-xs text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : disabled
                        ? "border-border bg-surface-2 text-muted-foreground/50 cursor-not-allowed"
                        : "border-border bg-surface-2 text-foreground hover:border-primary/50"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-[2px] bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/brand-profile"
            className="px-4 py-2 rounded-[2px] border border-border text-sm text-foreground hover:bg-surface-2 transition-colors"
          >
            Annulla
          </Link>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {submitting ? "Lancio in corso…" : "Lancia run"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Piano <span className="text-foreground font-medium uppercase">{plan}</span> · {15 * Math.max(1, models.length)} prompt totali stimati
      </p>
    </>
  );
}

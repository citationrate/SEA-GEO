"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Cpu, Info } from "lucide-react";
import { toast } from "sonner";
import { SuggestedQueriesEdit } from "@/components/suggested-queries";
import { InfoTooltip } from "@/components/ui/info-tooltip";

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
  const [modelsConfig, setModelsConfig] = useState<string[]>([]);
  const [existingQueries, setExistingQueries] = useState<{ text: string; funnel_stage: string }[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        setError("Impossibile caricare il progetto");
        setLoading(false);
        return;
      }
      const project = await res.json();
      setName(project.name ?? "");
      setTargetBrand(project.target_brand ?? "");
      setWebsiteUrl(project.website_url ?? "");
      setSector(project.sector ?? "");
      setBrandType(project.brand_type ?? "manufacturer");
      setMarketContext(project.market_context ?? "");
      setLanguage(project.language ?? "it");
      setCountry(project.country ?? "");
      setModelsConfig(project.models_config ?? []);
      setLoading(false);

      // Fetch existing queries
      const qRes = await fetch(`/api/queries?project_id=${projectId}`);
      if (qRes.ok) {
        const queries = await qRes.json();
        setExistingQueries(queries);
      }
    }
    load();
  }, [projectId]);

  async function refreshQueries() {
    const res = await fetch(`/api/queries?project_id=${projectId}`);
    if (res.ok) setExistingQueries(await res.json());
  }

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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore durante il salvataggio");
      }

      toast.success("Progetto aggiornato");
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
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
          Torna al progetto
        </a>
        <h1 className="font-display font-bold text-2xl text-foreground">Modifica Progetto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggiorna le informazioni del progetto
        </p>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA" && (e.target as HTMLElement).getAttribute("type") !== "submit") e.preventDefault(); }} className="card p-6 space-y-5">
        {/* Nome progetto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nome progetto *</label>
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
            Brand rilevato *
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

        {/* Sito web */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            Sito web ufficiale *
            <InfoTooltip text="Usato per rilevare le fonti owned nei risultati" />
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Settore
              <InfoTooltip text="Usato per suggerire query rilevanti per il tuo mercato" />
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="input-base"
            >
              <option value="">Seleziona...</option>
              {SECTOR_OPTIONS.map((s) => (
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
              {BRAND_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Query suggerite per settore */}
        {sector && (
          <SuggestedQueriesEdit
            sector={sector}
            projectId={projectId}
            existingQueries={existingQueries}
            onQueryAdded={refreshQueries}
          />
        )}

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

        {/* Modelli AI — read-only */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Modelli AI</label>
          <div className="flex items-start gap-2 flex-wrap bg-muted/50 border border-border rounded-[2px] px-4 py-3">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            {modelsConfig.length > 0 ? (
              modelsConfig.map((m) => (
                <span key={m} className="badge badge-primary text-[12px]">{m}</span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Nessun modello configurato</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Info className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              I modelli AI sono fissi per garantire dati comparabili nel tempo
            </p>
          </div>
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
          {saving ? "Salvataggio..." : "Salva Modifiche"}
        </button>
      </form>
    </div>
  );
}

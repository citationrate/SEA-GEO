"use client";

import { useEffect, useState } from "react";
import { Sparkles, X, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

// Sprint 3 (SEA-GEO) — Smart Prompt Suggestions modal.
// Pulls top-N AI keywords for the project's macro-sector × country from
// aivx-backend /ai-volumes/sector and lets the user one-click-add the ones
// they like as new queries on the project.

type SuggestionRow = {
  keyword: string;
  ai_volume: number;
};

const STR: Record<string, Record<string, string>> = {
  it: {
    title: "Suggerimenti basati sul tuo settore",
    subtitle: "Le top keyword AI del tuo settore × paese, ordinate per volume reale di ricerche AI. Aggiungile come query del progetto in un click.",
    sectorLabel: "Macro-settore",
    countryLabel: "Paese",
    cta: "Trova i suggerimenti",
    addSelected: "Aggiungi selezionate",
    loading: "Ricerca volumi AI...",
    adding: "Aggiungendo...",
    done: "Aggiunte {n} query al progetto",
    none: "Nessun suggerimento disponibile.",
    error: "Errore: ",
    headerKw: "Keyword",
    headerVol: "Volume AI",
    selectAll: "Seleziona tutte",
    deselectAll: "Deseleziona tutte",
    upsell: "Funzionalità a pagamento. Aggiorna piano per usarla.",
    quotaExceeded: "Hai raggiunto il limite di ricerche del tuo piano.",
    triggerLabel: "Suggerisci da settore",
  },
  en: {
    title: "Suggestions based on your sector",
    subtitle: "Top AI keywords for your sector × country, ranked by real AI search volume. Add them to your project queries in one click.",
    sectorLabel: "Macro-sector",
    countryLabel: "Country",
    cta: "Find suggestions",
    addSelected: "Add selected",
    loading: "Loading AI volumes...",
    adding: "Adding...",
    done: "Added {n} queries to the project",
    none: "No suggestions available.",
    error: "Error: ",
    headerKw: "Keyword",
    headerVol: "AI Volume",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    upsell: "Paid feature. Upgrade plan to use it.",
    quotaExceeded: "You hit the search limit of your plan.",
    triggerLabel: "Suggest by sector",
  },
  es: {
    title: "Sugerencias basadas en su sector",
    subtitle: "Las palabras clave IA principales de su sector × país, clasificadas por volumen real de búsquedas IA. Añádalas a las consultas del proyecto en un clic.",
    sectorLabel: "Macro-sector",
    countryLabel: "País",
    cta: "Buscar sugerencias",
    addSelected: "Añadir seleccionadas",
    loading: "Cargando volúmenes IA...",
    adding: "Añadiendo...",
    done: "Añadidas {n} consultas al proyecto",
    none: "Sin sugerencias disponibles.",
    error: "Error: ",
    headerKw: "Palabra clave",
    headerVol: "Volumen IA",
    selectAll: "Seleccionar todo",
    deselectAll: "Deseleccionar todo",
    upsell: "Función de pago. Actualice el plan.",
    quotaExceeded: "Ha alcanzado el límite de búsquedas de su plan.",
    triggerLabel: "Sugerir por sector",
  },
  fr: {
    title: "Suggestions basées sur votre secteur",
    subtitle: "Les principaux mots-clés IA de votre secteur × pays, classés par volume réel de recherches IA. Ajoutez-les aux requêtes du projet en un clic.",
    sectorLabel: "Macro-secteur",
    countryLabel: "Pays",
    cta: "Trouver des suggestions",
    addSelected: "Ajouter sélectionnées",
    loading: "Chargement des volumes IA...",
    adding: "Ajout en cours...",
    done: "{n} requêtes ajoutées au projet",
    none: "Aucune suggestion disponible.",
    error: "Erreur : ",
    headerKw: "Mot-clé",
    headerVol: "Volume IA",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    upsell: "Fonctionnalité payante. Mettez à niveau.",
    quotaExceeded: "Vous avez atteint la limite de recherches de votre plan.",
    triggerLabel: "Suggérer par secteur",
  },
  de: {
    title: "Vorschläge basierend auf Ihrer Branche",
    subtitle: "Top-KI-Keywords für Ihre Branche × Land, sortiert nach echtem KI-Suchvolumen. Fügen Sie sie mit einem Klick zu den Projektabfragen hinzu.",
    sectorLabel: "Makro-Branche",
    countryLabel: "Land",
    cta: "Vorschläge finden",
    addSelected: "Ausgewählte hinzufügen",
    loading: "Lade KI-Volumen...",
    adding: "Wird hinzugefügt...",
    done: "{n} Abfragen zum Projekt hinzugefügt",
    none: "Keine Vorschläge verfügbar.",
    error: "Fehler: ",
    headerKw: "Keyword",
    headerVol: "KI-Volumen",
    selectAll: "Alle auswählen",
    deselectAll: "Alle abwählen",
    upsell: "Kostenpflichtige Funktion. Bitte upgraden.",
    quotaExceeded: "Sie haben das Suchlimit Ihres Tarifs erreicht.",
    triggerLabel: "Vorschläge nach Branche",
  },
};

const SECTORS = ["YMYL", "E-COM", "LOCAL", "KNOW"] as const;
const COUNTRIES = ["IT", "US", "GB", "ES", "FR", "DE"] as const;

// Heuristic mapping AVI sector text → CS macro-sector. Default: KNOW.
function mapSector(s?: string | null): typeof SECTORS[number] {
  if (!s) return "KNOW";
  const x = s.toLowerCase();
  if (/(finanz|insur|pharma|salute|health|legal|medic)/.test(x)) return "YMYL";
  if (/(ristoran|hotel|turismo|tourism|local|store|shop|negozio)/.test(x)) return "LOCAL";
  if (/(commerc|ecommerce|moda|fashion|food|aliment|bevand|automotive|retail)/.test(x)) return "E-COM";
  return "KNOW";
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n || 0);
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultSector?: string | null;
  defaultCountry?: string | null;
  onAdded?: () => void;
}

export default function SmartSuggestionsModal({
  open, onClose, projectId, defaultSector, defaultCountry, onAdded,
}: Props) {
  const { locale } = useTranslation();
  const s = STR[locale] || STR.it;

  const [macro, setMacro] = useState<typeof SECTORS[number]>(() => mapSector(defaultSector));
  const [country, setCountry] = useState<string>(defaultCountry || "IT");
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    createClient()
      .auth.getSession()
      .then((res: { data: { session: { access_token?: string } | null } }) => {
        setToken(res.data.session?.access_token || null);
      });
    setRows([]);
    setSelected(new Set());
    setDoneCount(null);
    setErr(null);
  }, [open]);

  if (!open) return null;

  async function fetchSuggestions() {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setRows([]);
    setSelected(new Set());
    setDoneCount(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(
        `${apiUrl}/ai-volumes/sector?macro=${macro}&country=${country}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) setErr(s.upsell);
        else if (res.status === 429) setErr(s.quotaExceeded);
        else setErr(`${s.error}${body?.detail || `HTTP ${res.status}`}`);
        return;
      }
      const data = await res.json();
      const out: SuggestionRow[] = (data?.results || []).map((r: { keyword: string; ai_volume: number }) => ({
        keyword: String(r.keyword || ""),
        ai_volume: Number(r.ai_volume || 0),
      }));
      setRows(out.filter((r) => r.keyword));
    } catch (e) {
      setErr(`${s.error}${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function toggle(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.keyword)));
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setAdding(true);
    setErr(null);
    let added = 0;
    for (const kw of Array.from(selected)) {
      try {
        const res = await fetch(`/api/queries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            text: kw,
            funnel_stage: "tofu",
          }),
        });
        if (res.ok || res.status === 409) added++;
      } catch {
        // continue with others
      }
    }
    setAdding(false);
    setDoneCount(added);
    if (added > 0 && onAdded) onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-start gap-3">
            <Sparkles className="text-emerald-500 mt-0.5" size={22} />
            <div>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">{s.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">{s.sectorLabel}</label>
            <select
              value={macro}
              onChange={(e) => setMacro(e.target.value as typeof SECTORS[number])}
              className="bg-background border border-border rounded px-3 py-1.5 text-sm"
            >
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">{s.countryLabel}</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-background border border-border rounded px-3 py-1.5 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={loading || !token}
            className="ml-auto px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
          >
            {loading ? <Loader2 className="inline animate-spin" size={14} /> : s.cta}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {err && (
            <div className="m-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{err}</div>
          )}
          {doneCount !== null && doneCount > 0 && (
            <div className="m-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500 flex items-center gap-2">
              <Check size={16} /> {s.done.replace("{n}", String(doneCount))}
            </div>
          )}
          {loading && rows.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Loader2 className="inline animate-spin mr-2" size={14} /> {s.loading}
            </div>
          )}
          {!loading && rows.length === 0 && !err && (
            <div className="p-6 text-center text-muted-foreground text-sm italic">{s.none}</div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 w-10">
                    <button
                      onClick={toggleAll}
                      className="text-[10px] underline hover:text-foreground"
                    >
                      {selected.size === rows.length ? s.deselectAll : s.selectAll}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2">{s.headerKw}</th>
                  <th className="text-right px-4 py-2 w-32">{s.headerVol}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const checked = selected.has(r.keyword);
                  return (
                    <tr
                      key={i}
                      onClick={() => toggle(r.keyword)}
                      className={`border-t border-border cursor-pointer ${checked ? "bg-emerald-500/5" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={checked} readOnly className="accent-emerald-500" />
                      </td>
                      <td className="px-4 py-2">{r.keyword}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{fmtVolume(r.ai_volume)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-muted/10">
            <span className="text-xs text-muted-foreground">{selected.size} / {rows.length}</span>
            <button
              onClick={addSelected}
              disabled={adding || selected.size === 0}
              className="px-5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-sm font-semibold transition-colors"
            >
              {adding ? <Loader2 className="inline animate-spin" size={14} /> : s.addSelected}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

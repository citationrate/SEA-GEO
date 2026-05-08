"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

// Sprint 2 (SEA-GEO) — AI Volumes panel for the AVI project detail page.
// Fetches the project's queries and resolves per-keyword AI volume + AIO presence
// via aivx-backend /ai-volumes/keyword (proxied through the user's JWT).

type VolRow = {
  query: string;
  ai_volume: number;
  has_aio: boolean;
  top_sources: string[];
  loading: boolean;
  error?: boolean;
};

const STR: Record<string, Record<string, string>> = {
  it: {
    title: "Volumi AI dei tuoi prompt",
    subtitle: "Quanto vale ogni query del tuo progetto in volume di ricerca AI. I valori sono cachati 14 giorni.",
    headerKw: "Query",
    headerVol: "Volume AI",
    headerAio: "AIO",
    headerSources: "Top fonti",
    none: "Nessuna query attiva.",
    poweredBy: "Volumi stimati da DataForSEO · cache 14 giorni",
    loadingTxt: "Calcolo volumi...",
  },
  en: {
    title: "AI Volume of your prompts",
    subtitle: "How much each query in your project is worth in AI search volume. Values are cached for 14 days.",
    headerKw: "Query",
    headerVol: "AI Volume",
    headerAio: "AIO",
    headerSources: "Top sources",
    none: "No active queries.",
    poweredBy: "Volumes by DataForSEO · 14-day cache",
    loadingTxt: "Computing volumes...",
  },
  es: {
    title: "Volúmenes IA de sus prompts",
    subtitle: "Cuánto vale cada consulta del proyecto en volumen de búsqueda IA. Los valores se almacenan en caché 14 días.",
    headerKw: "Consulta",
    headerVol: "Volumen IA",
    headerAio: "AIO",
    headerSources: "Principales fuentes",
    none: "Sin consultas activas.",
    poweredBy: "Volúmenes por DataForSEO · caché 14 días",
    loadingTxt: "Calculando volúmenes...",
  },
  fr: {
    title: "Volumes IA de vos prompts",
    subtitle: "Combien vaut chaque requête de votre projet en volume de recherche IA. Les valeurs sont mises en cache pendant 14 jours.",
    headerKw: "Requête",
    headerVol: "Volume IA",
    headerAio: "AIO",
    headerSources: "Sources principales",
    none: "Aucune requête active.",
    poweredBy: "Volumes par DataForSEO · cache 14 jours",
    loadingTxt: "Calcul des volumes...",
  },
  de: {
    title: "KI-Volumen Ihrer Prompts",
    subtitle: "Wie viel jede Abfrage Ihres Projekts wert ist in KI-Suchvolumen. Werte werden 14 Tage zwischengespeichert.",
    headerKw: "Abfrage",
    headerVol: "KI-Volumen",
    headerAio: "AIO",
    headerSources: "Top-Quellen",
    none: "Keine aktiven Abfragen.",
    poweredBy: "Volumen von DataForSEO · 14-Tage-Cache",
    loadingTxt: "Berechne Volumen...",
  },
};

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n || 0);
}

interface Props {
  projectId: string;
  country?: string | null;
  /** Pre-loaded queries (server-rendered) — saves a round-trip. */
  queries: { id: string; text: string; is_active?: boolean }[];
}

export default function ProjectVolumesPanel({ projectId: _projectId, country, queries }: Props) {
  const { locale } = useTranslation();
  const s = STR[locale] || STR.it;
  const [rows, setRows] = useState<VolRow[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then((res: { data: { session: { access_token?: string } | null } }) => {
        setToken(res.data.session?.access_token || null);
      });
  }, []);

  useEffect(() => {
    // Initial state: shown loading, will resolve sequentially per query to be cache-friendly.
    const active = (queries || []).filter((q) => q.is_active !== false).slice(0, 10);
    setRows(active.map((q) => ({
      query: q.text, ai_volume: 0, has_aio: false, top_sources: [], loading: true,
    })));
  }, [queries]);

  useEffect(() => {
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    const c = (country || "IT").toUpperCase();

    let cancelled = false;
    (async () => {
      const active = (queries || []).filter((q) => q.is_active !== false).slice(0, 10);
      for (let i = 0; i < active.length; i++) {
        if (cancelled) return;
        const q = active[i];
        try {
          const res = await fetch(
            `${apiUrl}/ai-volumes/keyword?kw=${encodeURIComponent(q.text)}&country=${c}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const r = data?.result || {};
          setRows((prev) => {
            const next = [...prev];
            next[i] = {
              query: q.text,
              ai_volume: Number(r.ai_volume || 0),
              has_aio: Boolean(r.has_aio),
              top_sources: r.top_sources || [],
              loading: false,
            };
            return next;
          });
        } catch {
          setRows((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], loading: false, error: true };
            return next;
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, queries, country]);

  if (!queries || queries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={18} className="text-emerald-500" />
        <h3 className="text-sm font-semibold">{s.title}</h3>
        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500">
          NEW
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-2xl">{s.subtitle}</p>

      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">{s.headerKw}</th>
              <th className="text-right px-3 py-2 w-28">{s.headerVol}</th>
              <th className="text-center px-3 py-2 w-12">{s.headerAio}</th>
              <th className="text-left px-3 py-2">{s.headerSources}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground text-xs">
                  {s.none}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2 truncate max-w-[40ch]" title={r.query}>{r.query}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.loading ? (
                    <Loader2 size={12} className="inline animate-spin text-muted-foreground" />
                  ) : r.error ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    fmtVolume(r.ai_volume)
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.loading ? "" : r.has_aio ? (
                    <span className="text-emerald-500 font-bold">✓</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[40ch]">
                  {r.loading ? "" : (r.top_sources || []).slice(0, 3).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3">{s.poweredBy}</p>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

/* ─── Types ─── */

interface AiUpdate {
  id: string;
  provider: string;
  providerName: string;
  text: string;
  date: string;
  severity: "high" | "medium" | "low" | "info";
  severityLabel?: string;
}

interface AiUpdatesMeta {
  lastUpdated: string;
}

interface AiUpdatesData {
  _meta: AiUpdatesMeta;
  providers: { id: string; name: string; itemCount: number }[];
  updates: AiUpdate[];
}

/* ─── Constants ─── */

const STORAGE_KEY = "aisw_last_seen";
const JSON_URL =
  process.env.NEXT_PUBLIC_AI_UPDATES_JSON_URL || "/ai-updates.json";

const SEVERITY = {
  high:   { label: "Critico",       dot: "#DC2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.25)", text: "#DC2626" },
  medium: { label: "Comportamento", dot: "#D97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.25)", text: "#D97706" },
  low:    { label: "Miglioramento", dot: "#2563EB", bg: "rgba(37,99,235,0.08)",  border: "rgba(37,99,235,0.25)", text: "#2563EB" },
  info:   { label: "Info",          dot: "#6B7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", text: "#6B7280" },
};

/* ─── Helpers ─── */

function getLastSeen(): string {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}
function setLastSeen(ts: string) {
  try { localStorage.setItem(STORAGE_KEY, ts); } catch { /* noop */ }
}

/* ─── Component ─── */

export function AiNewsPanel() {
  const [data, setData] = useState<AiUpdatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(JSON_URL + "?t=" + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AiUpdatesData = await res.json();
      setData(json);

      // Mark as read
      if (json._meta?.lastUpdated) {
        setLastSeen(json._meta.lastUpdated);
      }
    } catch (err) {
      setError("Impossibile caricare gli aggiornamenti AI.");
      console.warn("[ai-news] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        {error || "Nessun dato disponibile."}
      </div>
    );
  }

  const providers = data.providers || [];
  const updates = data.updates?.filter((u) => {
    if (filter === "all") return true;
    return u.provider === filter;
  }) || [];

  const lastUpdated = data._meta?.lastUpdated
    ? new Date(data._meta.lastUpdated).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="space-y-5">
      {/* Header meta */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          Ultimo aggiornamento: {lastUpdated}
        </p>
        <p className="text-xs text-muted-foreground">
          {updates.length} aggiornament{updates.length === 1 ? "o" : "i"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wide transition-colors border ${
            filter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
          }`}
        >
          Tutti
        </button>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setFilter(p.id)}
            className={`px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wide transition-colors border ${
              filter === p.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Items */}
      {updates.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nessun aggiornamento trovato.
        </div>
      ) : (
        <div className="space-y-0 border border-border rounded-[2px] overflow-hidden">
          {updates.map((item, i) => {
            const sev = SEVERITY[item.severity] || SEVERITY.info;
            const date = new Date(item.date).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={item.id || i}
                className="flex gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors"
              >
                {/* Severity dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: sev.dot }}
                />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm text-foreground leading-relaxed">
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-[2px]"
                      style={{
                        background: sev.bg,
                        color: sev.text,
                        border: `1px solid ${sev.border}`,
                      }}
                    >
                      {sev.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.providerName} · {date}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground font-mono">
        Aggiornato automaticamente dai changelog ufficiali
      </p>
    </div>
  );
}

/* ─── Unread check — exported for sidebar badge ─── */

export function hasUnreadNews(): boolean {
  if (typeof window === "undefined") return false;
  const lastSeen = getLastSeen();
  if (!lastSeen) return true; // never opened → assume unread
  // We can't check against server data synchronously,
  // so this is a conservative check from last visit
  return false;
}

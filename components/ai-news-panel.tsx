"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ExternalLink, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

/* ─── Types ─── */

interface AiProvider {
  id: string;
  name: string;
  color: string;
  logo: string;
  itemCount: number;
}

interface AiUpdate {
  id: string;
  provider: string;
  providerName: string;
  providerColor: string;
  text: string;
  date: string;
  severity: "high" | "medium" | "low" | "info";
  severityLabel?: string;
  source?: string;
}

interface AiUpdatesData {
  _meta: {
    version: string;
    lastUpdated: string;
    nextUpdate: string;
    totalItems: number;
  };
  globalStatus: {
    level: string;
    label: string;
    color: string;
  };
  providers: AiProvider[];
  updates: AiUpdate[];
}

/* ─── Config ─── */

const STORAGE_KEY = "aisw_last_seen";
const JSON_URL =
  "https://raw.githubusercontent.com/dalboscoserena-19/ai-status-plugin/main/ai-updates.json";
const MAX_ITEMS = 10;
const VISIBLE_PROVIDERS = ["anthropic", "openai", "google", "perplexity", "copilot"];

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  high:   { bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.20)", text: "#DC2626" },
  medium: { bg: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.20)", text: "#D97706" },
  low:    { bg: "rgba(5,150,105,0.06)", border: "rgba(5,150,105,0.20)", text: "#059669" },
  ok:     { bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.20)", text: "#6B7280" },
};

/* ─── localStorage ─── */

function getLastSeen(): string {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}
function setLastSeen(ts: string) {
  try { localStorage.setItem(STORAGE_KEY, ts); } catch { /* noop */ }
}

/* ─── Severity colors (language-independent) ─── */

const SEV_STYLE: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  high:   { dot: "#DC2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.25)", text: "#DC2626" },
  medium: { dot: "#D97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.25)", text: "#D97706" },
  low:    { dot: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", text: "#3B82F6" },
  info:   { dot: "#6B7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)", text: "#6B7280" },
};

/* ─── Component ─── */

export function AiNewsPanel() {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<AiUpdatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const sevLabel: Record<string, string> = {
    high: t("aiNews.severityHigh"),
    medium: t("aiNews.severityMedium"),
    low: t("aiNews.severityLow"),
    info: t("aiNews.severityInfo"),
  };

  const dateLocale = locale === "it" ? "it-IT" : locale === "en" ? "en-GB" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "es-ES";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(JSON_URL + "?t=" + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AiUpdatesData = await res.json();
      setData(json);

      if (json._meta?.lastUpdated) {
        setLastSeen(json._meta.lastUpdated);
      }
    } catch (err) {
      setError(t("aiNews.noResults"));
      console.warn("[ai-news] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        {error || t("aiNews.noResults")}
      </div>
    );
  }

  const providers = (data.providers || []).filter((p) =>
    VISIBLE_PROVIDERS.includes(p.id),
  );

  const allUpdates = (data.updates || []).filter((u) =>
    VISIBLE_PROVIDERS.includes(u.provider),
  );

  const filtered = filter === "all"
    ? allUpdates
    : allUpdates.filter((u) => u.provider === filter);

  const visible = filtered.slice(0, MAX_ITEMS);

  const lastUpdated = data._meta?.lastUpdated
    ? new Date(data._meta.lastUpdated).toLocaleDateString(dateLocale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const gs = data.globalStatus;
  const gsStyle = STATUS_STYLE[gs?.level] || STATUS_STYLE.ok;

  return (
    <div className="space-y-5">
      {/* English notice */}
      <div className="flex items-center gap-2.5 rounded-[2px] px-4 py-3 bg-muted/30 border border-border">
        <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("aiNews.englishNotice")}
        </p>
      </div>

      {/* Global status banner */}
      {gs && (
        <div
          className="rounded-[2px] px-4 py-3 flex items-center gap-3"
          style={{ background: gsStyle.bg, border: `1px solid ${gsStyle.border}` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: gs.color }}
          />
          <p className="text-sm font-medium" style={{ color: gsStyle.text }}>
            {gs.label}
          </p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          {t("aiNews.lastUpdate")}: {lastUpdated}
        </p>
        <p className="text-xs text-muted-foreground">
          {allUpdates.length} {allUpdates.length === 1 ? t("aiNews.updateCount") : t("aiNews.updatesCount")}
        </p>
      </div>

      {/* Provider filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wide transition-colors border ${
            filter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
          }`}
        >
          {t("aiNews.filterAll")}
        </button>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setFilter(p.id)}
            className={`px-3 py-1.5 rounded-[2px] text-xs font-mono tracking-wide transition-colors border flex items-center gap-1.5 ${
              filter === p.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <span>{p.logo}</span>
            <span className="uppercase">{p.name.split(" ")[0]}</span>
            {p.itemCount > 0 && (
              <span
                className="text-[0.6rem] font-semibold px-1 rounded-[2px]"
                style={{
                  background: filter === p.id ? "rgba(255,255,255,0.2)" : "rgba(126,184,154,0.12)",
                  color: filter === p.id ? "inherit" : "var(--primary)",
                }}
              >
                {p.itemCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {t("aiNews.noResults")}
        </div>
      ) : (
        <div className="border border-border rounded-[2px] overflow-hidden divide-y divide-border">
          {visible.map((item, i) => {
            const sev = SEV_STYLE[item.severity] || SEV_STYLE.info;
            const date = new Date(item.date).toLocaleDateString(dateLocale, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });

            return (
              <div
                key={item.id || i}
                className="flex gap-3 px-4 py-3.5 hover:bg-surface-2/50 transition-colors"
              >
                {/* Provider color dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: item.providerColor || sev.dot }}
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    {item.source ? (
                      <a
                        href={item.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline transition-colors"
                      >
                        {item.text}
                      </a>
                    ) : item.text}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Severity badge — translated */}
                    <span
                      className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-[2px]"
                      style={{
                        background: sev.bg,
                        color: sev.text,
                        border: `1px solid ${sev.border}`,
                      }}
                    >
                      {sevLabel[item.severity] || sevLabel.info}
                    </span>

                    {/* Provider + date */}
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.providerName} · {date}
                    </span>

                    {/* Source link */}
                    {item.source && (
                      <a
                        href={item.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="font-mono">{t("aiNews.source")}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Truncation notice */}
      {filtered.length > MAX_ITEMS && (
        <p className="text-center text-xs text-muted-foreground">
          {t("aiNews.showingOf").replace("{shown}", String(MAX_ITEMS)).replace("{total}", String(filtered.length))}
        </p>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground font-mono">
        {t("aiNews.footer")}
      </p>
    </div>
  );
}

/* ─── Unread check — exported for sidebar dot ─── */

export function useHasUnreadNews() {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const lastSeen = getLastSeen();
    if (!lastSeen) {
      setUnread(true);
      return;
    }

    fetch(JSON_URL + "?t=" + Date.now())
      .then((r) => r.json())
      .then((json: AiUpdatesData) => {
        if (json._meta?.lastUpdated) {
          setUnread(new Date(json._meta.lastUpdated) > new Date(lastSeen));
        }
      })
      .catch(() => {});
  }, []);

  return unread;
}

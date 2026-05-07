"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "@/lib/i18n/context";

interface HistoryItem {
  id: string;
  brand_name: string;
  sector: string;
  country: string;
  locale: string;
  status: string;
  completed_at: string | null;
  started_at: string;
  models: string[];
  scores: {
    recognition: number | null;
    clarity: number | null;
    authority: number | null;
    relevance: number | null;
    sentiment: number | null;
    total: number | null;
  } | null;
}

type SortKey = "date" | "brand" | "score";
type SortDir = "asc" | "desc";

const SERIES_COLORS = [
  "#7eb89a", "#c4a882", "#7aa9d6", "#e08a8a",
  "#a3a3a3", "#b6c47e", "#d4a373", "#8884d8",
];

function scoreColor(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n <= 30) return "text-red-400";
  if (n <= 50) return "text-amber-400";
  if (n <= 70) return "text-sky-400";
  if (n <= 85) return "text-primary";
  return "text-emerald-400";
}

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
  padding: "6px 10px",
};

export function HistoryClient({
  items,
  showTimeSeries,
}: {
  items: HistoryItem[];
  showTimeSeries: boolean;
}) {
  const { t } = useTranslation();
  const [completedOnly, setCompletedOnly] = useState(true);
  const [country, setCountry] = useState<string>("");
  const [sector, setSector] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const countries = useMemo(
    () => Array.from(new Set(items.map((i) => i.country))).sort(),
    [items],
  );
  const sectors = useMemo(
    () => Array.from(new Set(items.map((i) => i.sector))).sort(),
    [items],
  );
  const brands = useMemo(
    () => Array.from(new Set(items.map((i) => i.brand_name))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    let out = items.slice();
    if (completedOnly) out = out.filter((i) => i.status === "completed");
    if (country) out = out.filter((i) => i.country === country);
    if (sector) out = out.filter((i) => i.sector === sector);
    if (brand) out = out.filter((i) => i.brand_name === brand);
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        const ad = (a.completed_at ?? a.started_at) || "";
        const bd = (b.completed_at ?? b.started_at) || "";
        cmp = ad < bd ? -1 : ad > bd ? 1 : 0;
      } else if (sortKey === "brand") {
        cmp = a.brand_name.localeCompare(b.brand_name);
      } else {
        cmp = Number(a.scores?.total ?? -1) - Number(b.scores?.total ?? -1);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [items, completedOnly, country, sector, brand, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "brand" ? "asc" : "desc");
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const seriesByBrand = useMemo(() => {
    if (!showTimeSeries) return null;
    const map = new Map<string, Array<{ date: string; total: number }>>();
    for (const it of items) {
      if (it.status !== "completed" || !it.completed_at || it.scores?.total == null) continue;
      const arr = map.get(it.brand_name) ?? [];
      arr.push({
        date: it.completed_at.slice(0, 10),
        total: Math.round(Number(it.scores.total)),
      });
      map.set(it.brand_name, arr);
    }
    const brandsWithSeries = Array.from(map.entries())
      .filter(([, arr]) => arr.length >= 2)
      .map(([brand, arr]) => ({
        brand,
        points: arr.sort((a, b) => (a.date < b.date ? -1 : 1)),
      }));
    return brandsWithSeries;
  }, [items, showTimeSeries]);

  const tsChartData = useMemo(() => {
    if (!seriesByBrand || seriesByBrand.length === 0) return [];
    const allDates = Array.from(
      new Set(seriesByBrand.flatMap((s) => s.points.map((p) => p.date))),
    ).sort();
    return allDates.map((date) => {
      const row: Record<string, string | number> = { date };
      for (const s of seriesByBrand) {
        const point = s.points.find((p) => p.date === date);
        if (point) row[s.brand] = point.total;
      }
      return row;
    });
  }, [seriesByBrand]);

  return (
    <>
      <div>
        <Link
          href="/brand-profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          {t("brandProfile.backToRuns")}
        </Link>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          {t("brandProfile.historyTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("brandProfile.historySubtitle")}</p>
      </div>

      {showTimeSeries && seriesByBrand && seriesByBrand.length > 0 && (
        <div className="card p-6 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-foreground">{t("brandProfile.historyTimeSeriesTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("brandProfile.historyTimeSeriesHelp")}</p>
          </div>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tsChartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--line)" />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--line)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                {seriesByBrand.map((s, i) => (
                  <Line
                    key={s.brand}
                    type="monotone"
                    dataKey={s.brand}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={completedOnly}
              onChange={(e) => setCompletedOnly(e.target.checked)}
              className="accent-primary"
            />
            {t("brandProfile.historyCompletedOnly")}
          </label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="bg-surface-2 border border-border rounded-[2px] text-base md:text-sm px-3 py-2 md:px-2 md:py-1 text-foreground min-h-[44px] md:min-h-0"
          >
            <option value="">{t("brandProfile.historyFilterAllBrands")}</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-surface-2 border border-border rounded-[2px] text-base md:text-sm px-3 py-2 md:px-2 md:py-1 text-foreground min-h-[44px] md:min-h-0"
          >
            <option value="">{t("brandProfile.historyFilterAllCountries")}</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-surface-2 border border-border rounded-[2px] text-base md:text-sm px-3 py-2 md:px-2 md:py-1 text-foreground min-h-[44px] md:min-h-0"
          >
            <option value="">{t("brandProfile.historyFilterAllSectors")}</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} / {items.length}
          </span>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {t("brandProfile.historyEmpty")}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3">
                  <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    {t("brandProfile.historyColDate")} {sortIcon("date")}
                  </button>
                </th>
                <th className="text-left p-3">
                  <button onClick={() => toggleSort("brand")} className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    {t("brandProfile.historyColBrand")} {sortIcon("brand")}
                  </button>
                </th>
                <th className="text-left p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {t("brandProfile.historyColSector")}
                </th>
                <th className="text-left p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {t("brandProfile.historyColCountry")}
                </th>
                <th className="text-right p-3">
                  <button onClick={() => toggleSort("score")} className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground ml-auto">
                    {t("brandProfile.scoreTotal")} {sortIcon("score")}
                  </button>
                </th>
                <th className="text-left p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {t("brandProfile.historyColStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const total = Number(it.scores?.total ?? 0);
                const dateStr = (it.completed_at ?? it.started_at).slice(0, 10);
                return (
                  <tr
                    key={it.id}
                    className="border-b border-border last:border-0 cursor-pointer transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(126,184,154,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td className="p-3 text-muted-foreground font-mono text-xs">
                      <Link href={`/brand-profile/${it.id}`} className="block">{dateStr}</Link>
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/brand-profile/${it.id}`} className="block">{it.brand_name}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <Link href={`/brand-profile/${it.id}`} className="block truncate max-w-[180px]">{it.sector}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <Link href={`/brand-profile/${it.id}`} className="block">{it.country}</Link>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/brand-profile/${it.id}`} className="block">
                        {it.scores?.total != null ? (
                          <span className={`font-mono font-semibold ${scoreColor(total)}`}>{Math.round(total)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link href={`/brand-profile/${it.id}`} className="block">
                        <span className={`inline-flex px-2 py-0.5 rounded-[2px] text-[11px] border ${
                          it.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : it.status === "running" ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : it.status === "pending" ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                          : it.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {t(`brandProfile.status${it.status.charAt(0).toUpperCase()}${it.status.slice(1)}`)}
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

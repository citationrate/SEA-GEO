"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { GitCompare, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import {
  BP_COMPARE_MIN_RUNS,
  BP_COMPARE_MAX_RUNS,
} from "@/lib/brand-profile/plans";

interface RunRow {
  id: string;
  brand_name: string;
  sector: string;
  country: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface CompareItem {
  run: {
    id: string;
    brand_name: string;
    sector: string;
    country: string;
    locale: string;
    completed_at: string | null;
    models: string[];
  };
  scores: {
    recognition: number | null;
    clarity: number | null;
    authority: number | null;
    relevance: number | null;
    sentiment: number | null;
    total: number | null;
  } | null;
  diagnostics: Array<{
    pillar: string;
    cs_parameter_id: string;
    cs_status: "fail" | "partial" | "pass";
  }>;
}

const SERIES_COLORS = ["#7eb89a", "#c4a882", "#7aa9d6", "#e08a8a"];

const PILLAR_KEYS: Array<{ key: "recognition" | "clarity" | "authority" | "relevance" | "sentiment"; tKey: string }> = [
  { key: "recognition", tKey: "brandProfile.pillarRecognition" },
  { key: "clarity", tKey: "brandProfile.pillarClarity" },
  { key: "authority", tKey: "brandProfile.pillarAuthority" },
  { key: "relevance", tKey: "brandProfile.pillarRelevance" },
  { key: "sentiment", tKey: "brandProfile.pillarSentiment" },
];

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
  padding: "6px 10px",
};

function scoreColor(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n <= 30) return "text-red-400";
  if (n <= 50) return "text-amber-400";
  if (n <= 70) return "text-sky-400";
  if (n <= 85) return "text-primary";
  return "text-emerald-400";
}

function deltaTone(delta: number): string {
  if (delta >= 5) return "text-emerald-400";
  if (delta <= -5) return "text-red-400";
  return "text-muted-foreground";
}

export function CompareClient({ runs }: { runs: RunRow[] }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<CompareItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= BP_COMPARE_MAX_RUNS) return cur;
      return [...cur, id];
    });
  }

  async function runCompare() {
    if (selected.length < BP_COMPARE_MIN_RUNS) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/brand-profile/compare?runIds=${selected.join(",")}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error ?? t("brandProfile.compareError"));
        setItems(null);
      } else {
        setItems(json.items as CompareItem[]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("brandProfile.compareError"));
    } finally {
      setLoading(false);
    }
  }

  const radarData = useMemo(() => {
    if (!items) return [];
    const labels: Record<string, string> = {
      recognition: t("brandProfile.pillarRecognition"),
      clarity: t("brandProfile.pillarClarity"),
      authority: t("brandProfile.pillarAuthority"),
      relevance: t("brandProfile.pillarRelevance"),
      sentiment: t("brandProfile.pillarSentiment"),
    };
    return PILLAR_KEYS.map(({ key }) => {
      const row: Record<string, string | number> = { pillar: labels[key] };
      items.forEach((it, i) => {
        row[`run_${i}`] = Math.round(Number(it.scores?.[key] ?? 0));
      });
      return row;
    });
  }, [items, t]);

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
          <GitCompare className="w-6 h-6 text-primary" />
          {t("brandProfile.compareTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("brandProfile.compareSubtitle")}</p>
      </div>

      {runs.length < BP_COMPARE_MIN_RUNS && (
        <div className="card p-5 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-semibold text-amber-400">{t("brandProfile.compareNeedMoreRunsTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("brandProfile.compareNeedMoreRunsBody")}</p>
              <Link
                href="/brand-profile/new"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                {t("brandProfile.newRun")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {runs.length >= BP_COMPARE_MIN_RUNS && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display font-semibold text-foreground">{t("brandProfile.comparePickerTitle")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("brandProfile.comparePickerHelp")
                  .replace("{min}", String(BP_COMPARE_MIN_RUNS))
                  .replace("{max}", String(BP_COMPARE_MAX_RUNS))}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {selected.length}/{BP_COMPARE_MAX_RUNS}
              </span>
              <button
                type="button"
                onClick={runCompare}
                disabled={selected.length < BP_COMPARE_MIN_RUNS || loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-sm bg-primary text-ink hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                {t("brandProfile.compareRun")}
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {runs.map((r) => {
              const checked = selected.includes(r.id);
              const disabled = !checked && selected.length >= BP_COMPARE_MAX_RUNS;
              return (
                <li key={r.id}>
                  <label
                    className={`flex items-center gap-3 p-3 rounded-[2px] border cursor-pointer transition-colors ${
                      checked
                        ? "border-primary/50 bg-primary/5"
                        : disabled
                          ? "border-border opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary/30 hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(r.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{r.brand_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.sector} · {r.country} · {(r.completed_at ?? r.started_at).slice(0, 10)}
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {err && (
        <div className="card p-4 border-red-500/40 bg-red-500/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{err}</p>
        </div>
      )}

      {items && items.length >= BP_COMPARE_MIN_RUNS && (
        <>
          <div className="card p-6">
            <div className="w-full h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="78%">
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis
                    dataKey="pillar"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-syne, inherit)" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    stroke="var(--line)"
                    tickCount={6}
                  />
                  {items.map((it, i) => (
                    <Radar
                      key={it.run.id}
                      name={it.run.brand_name}
                      dataKey={`run_${i}`}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fillOpacity={0.12}
                      isAnimationActive
                    />
                  ))}
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {t("brandProfile.compareTablePillar")}
                  </th>
                  {items.map((it, i) => (
                    <th key={it.run.id} className="text-right p-3 font-mono text-xs uppercase tracking-wider">
                      <span style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}>
                        {it.run.brand_name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...PILLAR_KEYS, { key: "total" as const, tKey: "brandProfile.scoreTotal" }].map(({ key, tKey }) => {
                  const baseValue = Number((items[0].scores as any)?.[key] ?? 0);
                  return (
                    <tr key={key} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground font-medium">{t(tKey)}</td>
                      {items.map((it, i) => {
                        const v = Number((it.scores as any)?.[key] ?? 0);
                        const delta = i === 0 ? null : v - baseValue;
                        return (
                          <td key={it.run.id} className="p-3 text-right">
                            <span className={`font-mono font-semibold ${scoreColor(v)}`}>{Math.round(v)}</span>
                            {delta !== null && (
                              <span className={`ml-2 text-xs font-mono ${deltaTone(delta)}`}>
                                {delta > 0 ? "+" : ""}{Math.round(delta)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map((it, i) => {
              const failing = it.diagnostics.filter((d) => d.cs_status !== "pass").length;
              return (
                <Link
                  key={it.run.id}
                  href={`/brand-profile/${it.run.id}`}
                  className="card p-4 hover:border-primary/40 transition-colors block"
                >
                  <div
                    className="text-xs font-mono uppercase tracking-wider mb-2"
                    style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  >
                    {it.run.brand_name}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{it.run.sector}</div>
                    <div>{it.run.country} · {it.run.locale}</div>
                    <div>{(it.run.completed_at ?? "").slice(0, 10)}</div>
                    <div>{it.run.models.length} {t("brandProfile.modelsLabel")}</div>
                    {failing > 0 && (
                      <div className="text-amber-400">
                        {failing} {t("brandProfile.compareFailingParams")}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

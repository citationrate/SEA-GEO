"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/lib/i18n/context";
import { MODEL_MAP } from "@citationrate/llm-client";

interface TrendDataPoint {
  run: string;
  avi: number | null;
  prominence: number | null;
  sentiment: number | null;
  models_used?: string[];
  models_changed?: boolean;
  [key: string]: any;
}

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
};

function getModelColor(model: string): string {
  if (model.startsWith("gpt")) return "#e8956d";
  if (model.startsWith("claude")) return "#c4a882";
  if (model.startsWith("gemini")) return "#7eb3d4";
  if (model.startsWith("grok")) return "#9d9890";
  return "#9d9890";
}

function shortModelName(model: string): string {
  if (model.includes("gpt-5.4-mini")) return "GPT-5.4 mini";
  if (model.includes("gpt-4o-mini")) return "GPT-4o mini";
  if (model.includes("gpt-4o")) return "GPT-4o";
  if (model.includes("gpt-4.1-mini")) return "GPT-4.1 mini";
  if (model.includes("gpt-4.1")) return "GPT-4.1";
  if (model.includes("claude")) return "Claude";
  if (model.includes("gemini")) return "Gemini";
  if (model.includes("grok")) return "Grok";
  return model;
}

type TimeRange = "1m" | "3m" | "6m" | "1y" | "all";

const TIME_RANGE_KEYS: { key: TimeRange; tKey: string }[] = [
  { key: "1m",  tKey: "dashboard.time1m" },
  { key: "3m",  tKey: "dashboard.time3m" },
  { key: "6m",  tKey: "dashboard.time6m" },
  { key: "1y",  tKey: "dashboard.time1y" },
  { key: "all", tKey: "dashboard.timeAll" },
];

function getTimeRangeCutoff(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  switch (range) {
    case "1m": now.setMonth(now.getMonth() - 1); break;
    case "3m": now.setMonth(now.getMonth() - 3); break;
    case "6m": now.setMonth(now.getMonth() - 6); break;
    case "1y": now.setFullYear(now.getFullYear() - 1); break;
  }
  return now;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as TrendDataPoint | undefined;
  const models = point?.models_used ?? [];
  const modelLabels = models.map((m) => MODEL_MAP.get(m)?.label ?? m);
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 space-y-1">
      <div className="font-mono text-[12px] font-semibold">{label}</div>
      {payload
        .filter((p: any) => p.dataKey === "avi" || p.dataKey === "prominence" || p.dataKey === "sentiment")
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.color }} />
            <span style={{ color: "var(--cream-dim)" }}>{p.name ?? p.dataKey}</span>
            <span className="font-semibold ml-auto">{p.value ?? "-"}</span>
          </div>
        ))}
      {modelLabels.length > 0 && (
        <div className="pt-1 mt-1 border-t border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cream-dim)" }}>
            {modelLabels.length} {modelLabels.length === 1 ? "modello" : "modelli"}
            {point?.models_changed ? " · set modificato" : ""}
          </div>
          <div className="text-[11px] leading-snug" style={{ color: "var(--white)" }}>
            {modelLabels.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AVITrend({ data, models }: { data?: TrendDataPoint[]; models?: string[] }) {
  const { t } = useTranslation();
  const rawData = data ?? [];
  const trendData: TrendDataPoint[] = useMemo(() => {
    let prev: string[] | null = null;
    return rawData.map((d): TrendDataPoint => {
      const cur = (d.models_used ?? []).slice().sort();
      const changed = prev !== null && (
        cur.length !== prev.length || cur.some((m, i) => m !== prev![i])
      );
      prev = cur;
      return { ...d, models_changed: changed };
    });
  }, [rawData]);
  const modelKeys = (models ?? []).filter((m) => trendData.some((d) => d[m] != null));
  const showModels = modelKeys.length > 1;

  const allSeries = [
    { key: "avi",        label: "AVI",                    color: "#7eb89a" },
    { key: "prominence", label: t("dashboard.presence"),   color: "#e8956d" },
    { key: "sentiment",  label: "Sentiment",               color: "#7eb3d4" },
    ...(showModels ? modelKeys.map((m) => ({ key: m, label: shortModelName(m), color: getModelColor(m) })) : []),
  ];

  const [active, setActive] = useState<Set<string>>(() => new Set(allSeries.map((s) => s.key)));
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const filteredData = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    if (!cutoff) return trendData;
    return trendData.filter((d) => {
      if (!d.computed_at) return true;
      return new Date(d.computed_at) >= cutoff;
    });
  }, [trendData, timeRange]);

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (trendData.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.aviOverTime")}</h3>
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[13px] text-cream-dim">{t("dashboard.runAnalysisForTrend")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-sm text-foreground" style={{ fontWeight: 300 }}>{t("dashboard.aviOverTime")}</h3>
          <p className="font-mono text-[12px] text-cream-dim mt-0.5">{t("dashboard.visibilityScore")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/30 rounded-[2px] p-0.5 mr-1">
            {TIME_RANGE_KEYS.map((r) => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`px-2 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                  timeRange === r.key
                    ? "bg-primary text-primary-foreground"
                    : "text-cream-dim hover:text-foreground"
                }`}
              >
                {t(r.tKey)}
              </button>
            ))}
          </div>
          {allSeries.map((s) => {
            const on = active.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] font-mono text-[11px] transition-all border cursor-pointer"
                style={{
                  borderColor: on ? s.color : "var(--line)",
                  background: on ? `${s.color}10` : "transparent",
                  color: on ? s.color : "var(--cream-dim)",
                  opacity: on ? 1 : 0.4,
                }}
              >
                <span
                  className="w-3.5 h-0.5 rounded-sm inline-block"
                  style={{ background: s.color, opacity: on ? 1 : 0.3 }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false}/>
          <XAxis dataKey="run" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false}/>
          <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--line)", strokeWidth: 1 }}/>
          {active.has("avi") && (
            <Line
              type="monotone"
              dataKey="avi"
              stroke="#7eb89a"
              strokeWidth={3}
              dot={(props: any) => {
                const changed = props.payload?.models_changed;
                return (
                  <circle
                    key={`dot-avi-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={changed ? 6 : 5}
                    fill={changed ? "#c4a882" : "#7eb89a"}
                    stroke={changed ? "#7eb89a" : "none"}
                    strokeWidth={changed ? 2 : 0}
                  />
                );
              }}
              connectNulls
              activeDot={{ r: 7 }}
            />
          )}
          {active.has("prominence") && (
            <Line type="monotone" dataKey="prominence" stroke="#e8956d" strokeWidth={1.5} dot={{ r: 3, fill: "#e8956d" }} connectNulls activeDot={{ r: 5 }}/>
          )}
          {active.has("sentiment") && (
            <Line type="monotone" dataKey="sentiment" stroke="#7eb3d4" strokeWidth={1.5} dot={{ r: 3, fill: "#7eb3d4" }} connectNulls activeDot={{ r: 5 }}/>
          )}
          {showModels && modelKeys.map((m) =>
            active.has(m) ? (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                name={shortModelName(m)}
                stroke={getModelColor(m)}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: getModelColor(m) }}
                connectNulls
                activeDot={{ r: 5 }}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

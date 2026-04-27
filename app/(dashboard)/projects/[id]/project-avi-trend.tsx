"use client";

import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "@/lib/i18n/context";

interface TrendPoint {
  version: string;
  avi: number;
  presence: number;
  sentiment: number;
  computed_at?: string;
  [key: string]: string | number | undefined;
}

const MODEL_COLORS: Record<string, string> = {
  "gpt-5.4-mini": "#e8956d",
  "gpt-4o-mini": "#e8956d",
  "gpt-4o": "#e8956d",
  "gpt-4.1-mini": "#e8956d",
  "gpt-4.1": "#e8956d",
  "claude-3-5-sonnet-20241022": "#c4a882",
  "claude-sonnet-4-20250514": "#c4a882",
  "gemini-2.0-flash": "#7eb3d4",
  "gemini-2.5-flash-preview-04-17": "#7eb3d4",
  "grok-3-mini": "#9d9890",
};

function getModelColor(model: string): string {
  if (MODEL_COLORS[model]) return MODEL_COLORS[model];
  if (model.startsWith("gpt")) return "#e8956d";
  if (model.startsWith("claude")) return "#c4a882";
  if (model.startsWith("gemini")) return "#7eb3d4";
  if (model.startsWith("grok")) return "#9d9890";
  return "#9d9890";
}

function shortModelName(model: string): string {
  return model
    .replace("gpt-5.5-pro", "GPT-5.5 Pro")
    .replace("gpt-5.5", "GPT-5.5")
    .replace("gpt-5.4-mini", "GPT-5.4 mini")
    .replace("gpt-4o-mini", "GPT-4o mini")
    .replace("gpt-4o", "GPT-4o")
    .replace("gpt-4.1-mini", "GPT-4.1 mini")
    .replace("gpt-4.1", "GPT-4.1")
    .replace(/claude-.*sonnet.*/, "Claude Sonnet")
    .replace(/claude-opus.*/, "Claude Opus")
    .replace(/claude-haiku.*/, "Claude Haiku")
    .replace(/gemini-2\.0-flash/, "Gemini Flash")
    .replace(/gemini-2\.5-flash.*/, "Gemini 2.5 Flash")
    .replace(/grok-.*/, "Grok");
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

export function ProjectAVITrend({ data, models }: { data: TrendPoint[]; models?: string[] }) {
  const { t } = useTranslation();
  const modelKeys = (models ?? []).filter((m) => data.some((d) => d[m] != null));
  const showModels = modelKeys.length > 1;

  const allSeries = [
    { key: "avi", label: "AVI", color: "#7eb89a" },
    ...(showModels ? modelKeys.map((m) => ({ key: m, label: shortModelName(m), color: getModelColor(m) })) : []),
  ];

  const [active, setActive] = useState<Set<string>>(() => new Set(allSeries.map((s) => s.key)));
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const filteredData = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    if (!cutoff) return data;
    return data.filter((d) => {
      if (!d.computed_at) return true;
      return new Date(d.computed_at) >= cutoff;
    });
  }, [data, timeRange]);

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

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-display font-semibold text-foreground">AVI nel Tempo</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range filter */}
          <div className="flex items-center bg-muted/30 rounded-[2px] p-0.5 mr-2">
            {TIME_RANGE_KEYS.map((r) => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`px-2 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                  timeRange === r.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(r.tKey)}
              </button>
            ))}
          </div>
          {/* Series toggles */}
          {allSeries.map((s) => {
            const isActive = active.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] font-mono text-[12px] transition-all border"
                style={{
                  borderColor: isActive ? s.color : "var(--border)",
                  background: isActive ? `${s.color}10` : "transparent",
                  color: isActive ? s.color : "var(--muted-foreground)",
                  opacity: isActive ? 1 : 0.45,
                }}
              >
                <span
                  className="w-4 h-0.5 rounded-sm inline-block transition-opacity"
                  style={{ background: s.color, opacity: isActive ? 1 : 0.3 }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="version" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            {active.has("avi") && (
              <Line type="monotone" dataKey="avi" name="AVI" stroke="#7eb89a" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
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
                  dot={{ r: 3 }}
                  connectNulls
                />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

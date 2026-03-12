"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendPoint {
  version: string;
  avi: number;
  presence: number;
  sentiment: number;
  [key: string]: string | number; // per-model AVI keys like "gpt-4o-mini"
}

const MODEL_COLORS: Record<string, string> = {
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
    .replace("gpt-4o-mini", "GPT-4o mini")
    .replace("gpt-4o", "GPT-4o")
    .replace("gpt-4.1-mini", "GPT-4.1 mini")
    .replace("gpt-4.1", "GPT-4.1")
    .replace(/claude-.*sonnet.*/, "Claude Sonnet")
    .replace(/gemini-2\.0-flash/, "Gemini Flash")
    .replace(/gemini-2\.5-flash.*/, "Gemini 2.5 Flash")
    .replace(/grok-.*/, "Grok");
}

export function ProjectAVITrend({ data, models }: { data: TrendPoint[]; models?: string[] }) {
  const modelKeys = (models ?? []).filter((m) => data.some((d) => d[m] != null));
  const showModels = modelKeys.length > 1;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground">AVI nel Tempo</h2>
        <div className="flex items-center gap-4 font-mono text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: "#7eb89a" }} />
            AVI
          </span>
          {showModels && modelKeys.map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: getModelColor(m) }} />
              {shortModelName(m)}
            </span>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="version" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Line type="monotone" dataKey="avi" name="AVI" stroke="#7eb89a" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
            {showModels && modelKeys.map((m) => (
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
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

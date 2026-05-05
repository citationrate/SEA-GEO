"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarScores {
  recognition: number;
  clarity: number;
  authority: number;
  relevance: number;
  sentiment: number;
}

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
  padding: "6px 10px",
};

export function ScoreRadar({ scores, labels }: { scores: RadarScores; labels: Record<keyof RadarScores, string> }) {
  const data = (Object.keys(labels) as Array<keyof RadarScores>).map((k) => ({
    pillar: labels[k],
    score: Math.round(Number(scores[k] ?? 0)),
  }));

  return (
    <div className="w-full h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="78%">
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
          <Radar
            name="Score"
            dataKey="score"
            stroke="#7eb89a"
            strokeWidth={2}
            fill="#7eb89a"
            fillOpacity={0.15}
            isAnimationActive
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [`${v} / 100`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

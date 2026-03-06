"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendPoint {
  date: string;
  avi: number;
  presence: number;
  sentiment: number;
}

export function ProjectAVITrend({ data }: { data: TrendPoint[] }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-display font-semibold text-foreground">AVI Trend</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Legend />
            <Line type="monotone" dataKey="avi" name="AVI" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="presence" name="Presence" stroke="var(--accent)" strokeWidth={1.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="sentiment" name="Sentiment" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

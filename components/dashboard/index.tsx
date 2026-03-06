"use client";

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertCircle } from "lucide-react";

/* ─── AVI Ring ─── */
interface AVIRingProps { score: number | null; trend: number | null; }

export function AVIRing({ score, trend }: AVIRingProps) {
  const R = 52, C = 2 * Math.PI * R;
  const dash = score != null ? (score / 100) * C : 0;

  const Icon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? "text-muted-foreground"
    : trend > 0 ? "text-success" : "text-destructive";

  const components = [
    { label: "Presence",  v: score != null ? 72 : null },
    { label: "Rank",      v: score != null ? 58 : null },
    { label: "Sentiment", v: score != null ? 81 : null },
    { label: "Stability", v: score != null ? 90 : null },
  ];

  return (
    <div className="card p-5 h-full flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        AI Visibility Index
      </p>

      <div className="relative w-[140px] h-[140px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="7"/>
          <circle cx="60" cy="60" r={R} fill="none"
            stroke="hsl(var(--primary))" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={score != null ? C - dash : C}
            style={{ transition: "stroke-dashoffset 1.2s ease-out",
                     filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.5))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-[32px] text-foreground leading-none">
            {score != null ? Math.round(score) : "--"}
          </span>
          {score != null && <span className="text-xs text-muted-foreground">/100</span>}
        </div>
      </div>

      <div className={`flex items-center gap-1.5 text-xs ${trendColor}`}>
        <Icon className="w-3 h-3" />
        {trend != null
          ? <span>{trend > 0 ? "+" : ""}{trend.toFixed(1)} vs ultima run</span>
          : <span className="text-muted-foreground">Nessun dato</span>}
      </div>

      {score != null && (
        <div className="w-full space-y-2 pt-2 border-t border-border">
          {components.map(c => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">{c.label}</span>
              <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full transition-all duration-700"
                  style={{ width: c.v != null ? `${c.v}%` : "0%" }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-5 text-right">{c.v ?? "--"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Stats Row ─── */
const STATS = [
  { label: "Prompt Eseguiti",    value: "--", sub: "in tutte le run"     },
  { label: "Menzioni Brand",     value: "--", sub: "% delle risposte"    },
  { label: "Competitor Trovati", value: "--", sub: "discovery automatica"},
  { label: "Fonti Estratte",     value: "--", sub: "domini unici"        },
  { label: "Modelli AI",         value: "--", sub: "integrazioni attive"  },
  { label: "Analisi Eseguite",   value: "--", sub: "totale storico"      },
];

export function StatsRow() {
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {STATS.map(s => (
        <div key={s.label} className="card p-4 flex flex-col justify-between">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <div className="mt-2">
            <p className="font-display font-bold text-2xl text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── AVI Trend chart ─── */
const TREND_DATA = [
  { run: "Run 1", avi: 38, presence: 45, sentiment: 52 },
  { run: "Run 2", avi: 47, presence: 55, sentiment: 60 },
  { run: "Run 3", avi: 54, presence: 61, sentiment: 65 },
];

const TOOLTIP_STYLE = {
  background: "hsl(var(--surface-2))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export function AVITrend() {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm text-foreground">AVI nel Tempo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Punteggio di visibilità tra le analisi</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {[
            { label: "AVI",        color: "hsl(var(--primary))" },
            { label: "Sentiment",  color: "hsl(var(--accent))"  },
            { label: "Presence",   color: "hsl(var(--success))" },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-full inline-block" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={TREND_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
          <XAxis dataKey="run" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
          <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Line type="monotone" dataKey="avi"       stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }}/>
          <Line type="monotone" dataKey="sentiment" stroke="hsl(var(--accent))"  strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--accent))"  }}/>
          <Line type="monotone" dataKey="presence"  stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--success))" }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Competitor Bar ─── */
const COMP_DATA = [
  { name: "Comp. A", avi: 71 },
  { name: "Comp. B", avi: 54 },
  { name: "Comp. C", avi: 39 },
];

export function CompetitorBar() {
  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm text-foreground mb-4">Top Competitor</h3>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={COMP_DATA} layout="vertical">
          <XAxis type="number" domain={[0,100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Bar dataKey="avi" fill="hsl(var(--primary) / 0.65)" radius={[0,4,4,0]}/>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground text-center mt-1">Dati di esempio — lancia un'analisi</p>
    </div>
  );
}

/* ─── Recent Runs ─── */
const RUN_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
  running:   <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />,
  failed:    <AlertCircle className="w-3.5 h-3.5 text-destructive" />,
};

export function RecentRuns() {
  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm text-foreground mb-4">Ultime Analisi</h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-xs text-muted-foreground">Nessuna analisi ancora.</p>
        <a href="/analysis" className="text-xs text-primary hover:text-primary/70 transition-colors mt-2">
          Avvia la prima analisi →
        </a>
      </div>
    </div>
  );
}

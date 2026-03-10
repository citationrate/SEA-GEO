"use client";

import {
  LineChart, Line, BarChart, Bar, Cell, LabelList,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertCircle } from "lucide-react";

/* ─── AVI Ring ─── */
interface AVIRingProps {
  score: number | null;
  trend: number | null;
  components?: { label: string; v: number | null }[];
}

export function AVIRing({ score, trend, components }: AVIRingProps) {
  const R = 52, C = 2 * Math.PI * R;
  const dash = score != null ? (score / 100) * C : 0;

  const Icon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? "text-cream-dim"
    : trend > 0 ? "text-success" : "text-destructive";

  const comps = components ?? [
    { label: "Prominence", v: null },
    { label: "Rank",       v: null },
    { label: "Sentiment",  v: null },
    { label: "Consistency", v: null },
  ];

  return (
    <div className="card p-5 h-full flex flex-col items-center gap-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream-dim">
        AI Visibility Index
      </p>

      <div className="relative w-[140px] h-[140px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="7"/>
          <circle cx="60" cy="60" r={R} fill="none"
            stroke="var(--sage)" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={score != null ? C - dash : C}
            style={{ transition: "stroke-dashoffset 1.2s ease-out",
                     filter: "drop-shadow(0 0 6px var(--sage-glow))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[32px] text-foreground leading-none" style={{ fontWeight: 300 }}>
            {score != null ? Math.round(score) : "--"}
          </span>
          {score != null && <span className="font-mono text-[10px] text-cream-dim">/100</span>}
        </div>
      </div>

      <div className={`flex items-center gap-1.5 text-xs font-sans ${trendColor}`}>
        <Icon className="w-3 h-3" />
        {trend != null
          ? <span>{trend > 0 ? "+" : ""}{trend.toFixed(1)} vs ultima run</span>
          : <span className="text-cream-dim">Nessun dato precedente</span>}
      </div>

      {score != null && (
        <div className="w-full space-y-2 pt-2 border-t border-border">
          {comps.map(c => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-cream-dim w-16 shrink-0">{c.label}</span>
              <div className="flex-1 h-1 bg-ink-3 rounded-sm overflow-hidden">
                <div className="h-full bg-sage/50 rounded-sm transition-all duration-700"
                  style={{ width: c.v != null ? `${c.v}%` : "0%" }} />
              </div>
              <span className="font-mono text-[10px] text-cream-dim w-5 text-right">{c.v != null ? Math.round(c.v) : "--"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Stats Row ─── */
interface StatItem {
  label: string;
  value: string;
  sub: string;
}

export function StatsRow({ stats }: { stats?: StatItem[] }) {
  const items = stats ?? [
    { label: "Prompt Eseguiti",    value: "--", sub: "in tutte le run"     },
    { label: "Menzioni Brand",     value: "--", sub: "% delle risposte"    },
    { label: "Competitor Trovati", value: "--", sub: "discovery automatica"},
    { label: "Fonti Estratte",     value: "--", sub: "domini unici"        },
    { label: "Modelli AI",         value: "--", sub: "integrazioni attive"  },
    { label: "Analisi Eseguite",   value: "--", sub: "totale storico"      },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {items.map(s => (
        <div key={s.label} className="card p-4 flex flex-col justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-cream-dim">{s.label}</p>
          <div className="mt-2">
            <p className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>{s.value}</p>
            <p className="font-mono text-[10px] text-cream-dim mt-0.5">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── AVI Trend chart ─── */
interface TrendDataPoint {
  run: string;
  avi: number | null;
  prominence: number | null;
  sentiment: number | null;
}

const TOOLTIP_STYLE = {
  background: "var(--ink-3)",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 12,
  color: "var(--white)",
};

export function AVITrend({ data }: { data?: TrendDataPoint[] }) {
  const trendData = data ?? [];

  if (trendData.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>AVI nel Tempo</h3>
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[11px] text-cream-dim">Esegui almeno un&apos;analisi per vedere il trend</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm text-foreground" style={{ fontWeight: 300 }}>AVI nel Tempo</h3>
          <p className="font-mono text-[10px] text-cream-dim mt-0.5">Punteggio di visibilita tra le analisi</p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-cream-dim">
          {[
            { label: "AVI",        color: "var(--sage)" },
            { label: "Sentiment",  color: "var(--cream)"  },
            { label: "Prominence", color: "var(--success)" },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded-sm inline-block" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false}/>
          <XAxis dataKey="run" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false}/>
          <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Line type="monotone" dataKey="avi"        stroke="var(--sage)"    strokeWidth={2} dot={{ r: 4, fill: "var(--sage)" }}    connectNulls activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="sentiment"  stroke="var(--cream)"   strokeWidth={2} dot={{ r: 4, fill: "var(--cream)" }}   connectNulls activeDot={{ r: 6 }}/>
          <Line type="monotone" dataKey="prominence" stroke="var(--success)" strokeWidth={2} dot={{ r: 4, fill: "var(--success)" }} connectNulls activeDot={{ r: 6 }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Competitor Bar ─── */
interface CompetitorData {
  name: string;
  count: number;
}

export function CompetitorBar({ data }: { data?: CompetitorData[] }) {
  const compData = (data ?? []).sort((a, b) => b.count - a.count);

  if (compData.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>Top Competitor</h3>
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[11px] text-cream-dim">Nessun competitor trovato</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>Top Competitor</h3>
      <ResponsiveContainer width="100%" height={Math.max(80, compData.length * 35)}>
        <BarChart data={compData} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} allowDecimals={false}/>
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} width={90}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value} menzioni`, "Menzioni"]}/>
          <Bar dataKey="count" fill="var(--sage-dim)" radius={[0,2,2,0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--cream-dim)" }}/>
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Recent Runs ─── */
interface RunItem {
  id: string;
  project_id: string;
  project_name: string;
  version: number;
  status: string;
  avi_score: number | null;
  date: string;
}

const RUN_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
  running:   <Clock className="w-3.5 h-3.5 text-sage animate-pulse" />,
  failed:    <AlertCircle className="w-3.5 h-3.5 text-destructive" />,
};

export function RecentRuns({ runs }: { runs?: RunItem[] }) {
  const items = runs ?? [];

  return (
    <div className="card p-5">
      <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>Ultime Analisi</h3>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-mono text-[11px] text-cream-dim">Nessuna analisi ancora.</p>
          <a href="/projects" className="font-mono text-[11px] text-sage hover:text-sage/70 transition-colors mt-2">
            Vai ai progetti →
          </a>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map(r => (
            <a
              key={r.id}
              href={`/projects/${r.project_id}/runs/${r.id}`}
              className="flex items-center justify-between px-3 py-2 rounded-sm hover:bg-ink-3 transition-colors group"
            >
              <div className="flex items-center gap-2">
                {RUN_ICONS[r.status] ?? RUN_ICONS.failed}
                <span className="text-sm font-sans text-foreground group-hover:text-sage transition-colors">{r.project_name}</span>
                <span className="font-mono text-[10px] text-cream-dim">v{r.version}</span>
              </div>
              <div className="flex items-center gap-3">
                {r.avi_score != null && (
                  <span className="font-display text-sm text-sage" style={{ fontWeight: 300 }}>{r.avi_score}</span>
                )}
                <span className="font-mono text-[10px] text-cream-dim">{r.date}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

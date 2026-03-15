"use client";

import {
  LineChart, Line, BarChart, Bar, Cell, LabelList,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

/* ─── AVI Ring ─── */
interface AVIRingProps {
  score: number | null;
  trend: number | null;
  components?: { label: string; v: number | null }[];
  noBrandMentions?: boolean;
}

export function AVIRing({ score, trend, components, noBrandMentions }: AVIRingProps) {
  const { t } = useTranslation();
  const R = 52, C = 2 * Math.PI * R;
  const dash = score != null && !noBrandMentions ? (score / 100) * C : 0;

  const Icon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? "text-cream-dim"
    : trend > 0 ? "text-success" : "text-destructive";

  const COMP_COLORS: Record<string, string> = {
    Presenza:   "#e8956d",
    Posizione:  "#7eb3d4",
    Sentiment:  "#7eb89a",
  };

  const labelMap: Record<string, string> = {
    Presenza:     t("dashboard.presence"),
    Posizione:    t("dashboard.position"),
    Sentiment:    t("dashboard.sentiment"),
    "Affidabilità": t("dashboard.reliability"),
  };

  const tooltipMap: Record<string, string> = {
    Presenza:   t("dashboard.presenceTooltip"),
    Posizione:  t("dashboard.positionTooltip"),
    Sentiment:  t("dashboard.sentimentTooltip"),
  };

  const allComps = components ?? [
    { label: "Presenza",  v: null },
    { label: "Posizione", v: null },
    { label: "Sentiment", v: null },
  ];
  const consistencyComp = allComps.find(c => c.label === "Affidabilità");
  const comps = allComps.filter(c => c.label !== "Affidabilità");

  return (
    <div data-tour="avi-ring" className="card p-5 h-full flex flex-col items-center gap-3">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-cream-dim">
        {t("dashboard.aviIndex")}
      </p>

      <div className="relative w-[140px] h-[140px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="7"/>
          <circle cx="60" cy="60" r={R} fill="none"
            stroke={noBrandMentions ? "var(--line)" : "var(--sage)"} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - dash}
            style={{ transition: "stroke-dashoffset 1.2s ease-out",
                     filter: noBrandMentions ? "none" : "drop-shadow(0 0 6px var(--sage-glow))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-[32px] leading-none ${noBrandMentions ? "text-muted-foreground" : "text-foreground"}`} style={{ fontWeight: 300 }}>
            {score != null ? Math.round(score) : "--"}
          </span>
          {score != null && <span className="font-mono text-[12px] text-cream-dim">/100</span>}
        </div>
      </div>

      {noBrandMentions ? (
        <p className="text-xs text-muted-foreground text-center leading-snug px-2">
          {t("dashboard.noBrandDetected")}
        </p>
      ) : (
        <div className={`flex items-center gap-1.5 text-xs font-sans ${trendColor}`}>
          <Icon className="w-3 h-3" />
          {trend != null
            ? <span>{trend > 0 ? "+" : ""}{trend.toFixed(1)} {t("dashboard.vsLastRun")}</span>
            : <span className="text-cream-dim">{t("dashboard.noPreviousData")}</span>}
        </div>
      )}

      {score != null && (
        <div className="w-full space-y-2.5 pt-2 border-t border-border">
          {comps.map(c => (
            <div key={c.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[12px] text-cream-dim flex items-center gap-1">
                  {labelMap[c.label] ?? c.label}
                  {tooltipMap[c.label] && <InfoTooltip text={tooltipMap[c.label]} />}
                </span>
                <span className="font-mono text-[12px] text-cream-dim">{c.v != null ? Math.round(c.v) : "--"}</span>
              </div>
              <div className="w-full h-1 bg-ink-3 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm transition-all duration-700"
                  style={{ width: c.v != null ? `${c.v}%` : "0%", backgroundColor: COMP_COLORS[c.label] ?? "var(--sage)" }} />
              </div>
            </div>
          ))}
          {consistencyComp && consistencyComp.v != null && (
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[11px] font-medium ${
                  consistencyComp.v > 80
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : consistencyComp.v >= 50
                    ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}>
                  {consistencyComp.v > 80 ? t("dashboard.highReliability") : consistencyComp.v >= 50 ? t("dashboard.mediumReliability") : t("dashboard.lowReliability")} ({Math.round(consistencyComp.v)})
                </span>
                <InfoTooltip text={t("dashboard.reliabilityTooltip")} />
              </div>
            </div>
          )}
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
  const { t } = useTranslation();
  const items = stats ?? [
    { label: t("dashboard.promptsExecuted"),    value: "--", sub: t("dashboard.inAllRuns")     },
    { label: t("dashboard.brandMentions"),     value: "--", sub: t("dashboard.pctResponses")    },
    { label: t("dashboard.competitorsFound"), value: "--", sub: t("dashboard.autoDiscovery")},
    { label: t("dashboard.sourcesExtracted"),     value: "--", sub: t("dashboard.uniqueDomains")        },
    { label: t("dashboard.aiModels"),         value: "--", sub: t("dashboard.activeIntegrations")  },
    { label: t("dashboard.analysesRun"),   value: "--", sub: t("dashboard.totalHistory")      },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {items.map(s => (
        <div key={s.label} className="card p-4 flex flex-col justify-between">
          <p className="font-mono text-[12px] uppercase tracking-[0.04em] text-cream-dim">{s.label}</p>
          <div className="mt-2">
            <p className="font-display text-2xl text-foreground" style={{ fontWeight: 300 }}>{s.value}</p>
            <p className="font-mono text-[12px] text-cream-dim mt-0.5">{s.sub}</p>
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
  if (model.includes("gpt-4o-mini")) return "GPT-4o mini";
  if (model.includes("gpt-4o")) return "GPT-4o";
  if (model.includes("gpt-4.1-mini")) return "GPT-4.1 mini";
  if (model.includes("gpt-4.1")) return "GPT-4.1";
  if (model.includes("claude")) return "Claude";
  if (model.includes("gemini")) return "Gemini";
  if (model.includes("grok")) return "Grok";
  return model;
}

export function AVITrend({ data, models }: { data?: TrendDataPoint[]; models?: string[] }) {
  const { t } = useTranslation();
  const trendData = data ?? [];
  const modelKeys = (models ?? []).filter((m) => trendData.some((d) => d[m] != null));
  const showModels = modelKeys.length > 1;

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

  const legendItems = [
    { label: "AVI",      color: "#7eb89a" },
    { label: t("dashboard.presence"), color: "#e8956d" },
    { label: "Sentiment",color: "#7eb3d4" },
    ...(showModels ? modelKeys.map((m) => ({ label: shortModelName(m), color: getModelColor(m) })) : []),
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm text-foreground" style={{ fontWeight: 300 }}>{t("dashboard.aviOverTime")}</h3>
          <p className="font-mono text-[12px] text-cream-dim mt-0.5">{t("dashboard.visibilityScore")}</p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[12px] text-cream-dim flex-wrap">
          {legendItems.map(l => (
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
          <Line type="monotone" dataKey="avi"        stroke="#7eb89a" strokeWidth={3} dot={{ r: 5, fill: "#7eb89a" }} connectNulls activeDot={{ r: 7 }}/>
          <Line type="monotone" dataKey="prominence" stroke="#e8956d" strokeWidth={1.5} dot={{ r: 3, fill: "#e8956d" }} connectNulls activeDot={{ r: 5 }}/>
          <Line type="monotone" dataKey="sentiment"  stroke="#7eb3d4" strokeWidth={1.5} dot={{ r: 3, fill: "#7eb3d4" }} connectNulls activeDot={{ r: 5 }}/>
          {showModels && modelKeys.map((m) => (
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
          ))}
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
  const { t } = useTranslation();
  const compData = (data ?? []).sort((a, b) => b.count - a.count);

  if (compData.length === 0) {
    return (
      <div data-tour="top-competitors" className="card p-5">
        <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.topCompetitors")}</h3>
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[13px] text-cream-dim">{t("dashboard.noCompetitorFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="top-competitors" className="card p-5">
      <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.topCompetitors")}</h3>
      <ResponsiveContainer width="100%" height={Math.max(80, compData.length * 35)}>
        <BarChart data={compData} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} allowDecimals={false}/>
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--cream-dim)" }} axisLine={false} tickLine={false} width={90}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value} ${t("dashboard.mentions")}`, t("dashboard.mentions")]}/>
          <Bar dataKey="count" radius={[0,2,2,0]}>
            {compData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#e8956d" : i === 1 ? "#c4a882" : "rgba(196,168,130,0.5)"} />
            ))}
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
  const { t } = useTranslation();
  const items = runs ?? [];

  return (
    <div className="card p-5">
      <h3 className="font-display text-sm text-foreground mb-4" style={{ fontWeight: 300 }}>{t("dashboard.recentAnalyses")}</h3>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-mono text-[13px] text-cream-dim">{t("dashboard.noAnalysisYet")}</p>
          <a href="/projects" className="font-mono text-[13px] text-sage hover:text-sage/70 transition-colors mt-2">
            {t("common.goToProjects")} →
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
                <span className="font-mono text-[12px] text-cream-dim">v{r.version}</span>
              </div>
              <div className="flex items-center gap-3">
                {r.avi_score != null && (
                  <span className="font-display text-sm text-sage" style={{ fontWeight: 300 }}>{r.avi_score}</span>
                )}
                <span className="font-mono text-[12px] text-cream-dim">{r.date}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

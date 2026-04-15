"use client";

import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

// AVITrend and CompetitorBar live in their own files so the recharts bundle
// (~50KB gzip) is split off into separate chunks and only fetched when those
// charts actually mount on the dashboard.

/* ─── AVI Ring ─── */
interface AVIRingProps {
  score: number | null;
  trend: number | null;
  components?: { label: string; labelKey?: string; v: number | null }[];
  noBrandMentions?: boolean;
  hideComponents?: boolean;
}

export function AVIRing({ score, trend, components, noBrandMentions, hideComponents }: AVIRingProps) {
  const { t } = useTranslation();
  const R = 52, C = 2 * Math.PI * R;
  const dash = score != null && !noBrandMentions ? (score / 100) * C : 0;

  const Icon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend == null ? "text-cream-dim"
    : trend > 0 ? "text-success" : "text-destructive";

  // Pastel color interpolation matching design system palette
  // 0: muted coral (#c06a4a) → 50: muted amber (#c4a882) → 100: sage green (#7eb89a)
  function scoreToColor(v: number): string {
    const t = Math.max(0, Math.min(100, v)) / 100;
    const hue = t < 0.5
      ? 15 + t * 2 * 25     // 15→40: coral to amber
      : 40 + (t - 0.5) * 2 * 110; // 40→150: amber to sage green
    return `hsl(${Math.round(hue)}, 40%, 55%)`;
  }
  const aviColor = scoreToColor(score ?? 0);

  const COMP_COLORS: Record<string, string> = {
    "dashboard.presence":   "#e8956d",
    "dashboard.position":   "#7eb3d4",
    "dashboard.sentiment":  "#7eb89a",
  };

  const tooltipMap: Record<string, string> = {
    "dashboard.presence":   t("dashboard.presenceTooltip"),
    "dashboard.position":   t("dashboard.positionTooltip"),
    "dashboard.sentiment":  t("dashboard.sentimentTooltip"),
  };

  const allComps = components ?? [
    { label: t("dashboard.presence"), labelKey: "dashboard.presence", v: null },
    { label: t("dashboard.position"), labelKey: "dashboard.position", v: null },
    { label: t("dashboard.sentiment"), labelKey: "dashboard.sentiment", v: null },
  ];
  const consistencyComp = allComps.find(c => c.labelKey === "dashboard.reliability");
  const comps = allComps.filter(c => c.labelKey !== "dashboard.reliability");

  return (
    <div data-tour="avi-ring" className="card p-5 h-full flex flex-col items-center gap-3">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-cream-dim">
        {t("dashboard.aviIndex")}
      </p>

      <div className="relative w-[140px] h-[140px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" overflow="visible">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="7"/>
          <circle cx="60" cy="60" r={R} fill="none"
            stroke={noBrandMentions ? "var(--line)" : aviColor} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - dash}
            style={{ transition: "stroke-dashoffset 1.2s ease-out, stroke 0.8s ease-out",
                     filter: noBrandMentions ? "none" : `drop-shadow(0 0 6px ${aviColor})` }}
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

      {score != null && !hideComponents && (
        <div className="w-full space-y-2.5 pt-2 border-t border-border">
          {comps.map(c => {
            const key = c.labelKey ?? "";
            return (
              <div key={key || c.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[12px] text-cream-dim flex items-center gap-1">
                    {c.label}
                    {tooltipMap[key] && <InfoTooltip text={tooltipMap[key]} />}
                  </span>
                  <span className="font-mono text-[12px] text-cream-dim">{c.v != null ? Math.round(c.v) : "--"}</span>
                </div>
                <div className="w-full h-1 bg-ink-3 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm transition-all duration-700"
                    style={{ width: c.v != null ? `${c.v}%` : "0%", backgroundColor: COMP_COLORS[key] ?? "var(--sage)" }} />
                </div>
              </div>
            );
          })}
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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 h-full">
      {items.map(s => (
        <div key={s.label} className="card p-3 md:p-4 flex flex-col justify-between">
          <p className="font-mono text-[10px] md:text-[12px] uppercase tracking-[0.04em] text-cream-dim">{s.label}</p>
          <div className="mt-1.5 md:mt-2">
            <p className="font-display text-xl md:text-2xl text-foreground" style={{ fontWeight: 300 }}>{s.value}</p>
            <p className="font-mono text-[10px] md:text-[12px] text-cream-dim mt-0.5">{s.sub}</p>
          </div>
        </div>
      ))}
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

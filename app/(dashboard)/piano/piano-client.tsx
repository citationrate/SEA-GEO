"use client";

import { CreditCard, FolderOpen, BarChart3, Search, GitCompare, ArrowRight } from "lucide-react";
import Link from "next/link";

interface PianoClientProps {
  plan: string;
  subscriptionStatus: string;
  subscriptionPeriod: string | null;
  hasActiveSubscription: boolean;
  projectsCount: number;
  analysesThisMonth: number;
  queriesUsed: number;
  queriesLimit: number;
  comparisonsUsed: number;
  comparisonsLimit: number;
  extraComparisons: number;
}

const PLAN_CONFIG: Record<string, {
  label: string;
  projectsMax: number;
  analysesMax: number;
  queriesMax: number;
  showComparisons: boolean;
}> = {
  demo: { label: "Free", projectsMax: 1, analysesMax: 0, queriesMax: 0, showComparisons: false },
  free: { label: "Free", projectsMax: 1, analysesMax: 0, queriesMax: 0, showComparisons: false },
  base: { label: "Base", projectsMax: 1, analysesMax: 2, queriesMax: 100, showComparisons: false },
  pro: { label: "Pro", projectsMax: 5, analysesMax: 10, queriesMax: 300, showComparisons: true },
  agency: { label: "Pro", projectsMax: 5, analysesMax: 10, queriesMax: 300, showComparisons: true },
};

function barColor(used: number, max: number): string {
  if (max === 0) return "var(--muted-foreground)";
  const pct = used / max;
  if (pct > 0.9) return "#ef4444";
  if (pct > 0.7) return "#f59e0b";
  return "#10b981";
}

function barWidth(used: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.min(100, (used / max) * 100)}%`;
}

export function PianoClient({
  plan,
  subscriptionStatus,
  subscriptionPeriod,
  hasActiveSubscription,
  projectsCount,
  analysesThisMonth,
  queriesUsed,
  queriesLimit,
  comparisonsUsed,
  comparisonsLimit,
  extraComparisons,
}: PianoClientProps) {
  const config = PLAN_CONFIG[plan] || PLAN_CONFIG.demo;
  const isActive = subscriptionStatus === "active";
  const isDemo = plan === "demo" || plan === "free";

  return (
    <div className="max-w-[700px] space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display tracking-tight text-foreground" style={{ fontWeight: 300 }}>
          Il tuo piano
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visualizza il tuo piano attuale e i tuoi utilizzi.</p>
      </div>

      {/* Current plan card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[2px] flex items-center justify-center"
              style={{ background: isDemo ? "var(--surface-2)" : "rgba(126,184,154,0.15)" }}
            >
              <CreditCard className={`w-5 h-5 ${isDemo ? "text-muted-foreground" : "text-primary"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-foreground">{config.label}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full border font-medium"
                  style={
                    isActive
                      ? { color: "#10b981", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }
                      : { color: "var(--muted-foreground)", background: "var(--surface-2)", borderColor: "var(--border)" }
                  }
                >
                  {isActive ? "Attivo" : "Inattivo"}
                </span>
              </div>
              {subscriptionPeriod && isActive && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subscriptionPeriod === "yearly" ? "Abbonamento annuale" : "Abbonamento mensile"}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Gestisci abbonamento <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Usage bars */}
      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">I tuoi utilizzi</h2>

        {/* Progetti */}
        <UsageBar
          icon={<FolderOpen className="w-4 h-4" />}
          label="Progetti"
          used={projectsCount}
          max={config.projectsMax}
        />

        {/* Analisi questo mese */}
        <UsageBar
          icon={<BarChart3 className="w-4 h-4" />}
          label="Analisi questo mese"
          used={analysesThisMonth}
          max={config.analysesMax}
        />

        {/* Query disponibili — only Base and Pro */}
        {!isDemo && (
          <UsageBar
            icon={<Search className="w-4 h-4" />}
            label="Query disponibili"
            used={queriesUsed}
            max={queriesLimit}
            suffix="per analisi"
          />
        )}

        {/* Analisi comparative — only Pro, or show CTA */}
        {config.showComparisons && (
          comparisonsLimit > 0 ? (
            <UsageBar
              icon={<GitCompare className="w-4 h-4" />}
              label="Analisi comparative"
              used={comparisonsUsed}
              max={comparisonsLimit}
              extra={extraComparisons > 0 ? `+${extraComparisons} da pacchetti` : undefined}
            />
          ) : (
            <div className="flex items-center justify-between py-3 border-t border-border/50">
              <div className="flex items-center gap-2.5">
                <GitCompare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Analisi comparative</span>
              </div>
              <Link
                href="/settings"
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Acquista pacchetto
              </Link>
            </div>
          )
        )}
      </div>

      {/* Upgrade CTA for free users */}
      {isDemo && (
        <div className="card p-6 text-center space-y-3" style={{ background: "rgba(126,184,154,0.04)", borderColor: "rgba(126,184,154,0.15)" }}>
          <p className="text-sm text-foreground font-medium">Sblocca tutte le funzionalità</p>
          <p className="text-xs text-muted-foreground">Passa a Base o Pro per analizzare la tua visibilità AI.</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[2px] text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Vedi i piani <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable usage bar component ─── */

function UsageBar({
  icon,
  label,
  used,
  max,
  suffix,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  max: number;
  suffix?: string;
  extra?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <div className="text-sm text-foreground font-medium">
          {used} / {max}
          {suffix && <span className="text-xs text-muted-foreground ml-1">{suffix}</span>}
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: barWidth(used, max),
            background: barColor(used, max),
          }}
        />
      </div>
      {extra && (
        <p className="text-xs text-primary">{extra}</p>
      )}
    </div>
  );
}

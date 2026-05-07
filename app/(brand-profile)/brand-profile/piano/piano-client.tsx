"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Sparkles,
  Check,
  Radar,
  Activity,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

type ToolKey = "bp" | "cs" | "avi";
type PlanKey = "demo" | "base" | "pro" | "enterprise";

const TOOLS: Array<{ key: ToolKey; label: string; Icon: typeof Activity }> = [
  { key: "bp", label: "Brand Profile", Icon: Radar },
  { key: "cs", label: "Citability Score", Icon: Activity },
  { key: "avi", label: "AI Visibility Index", Icon: BarChart3 },
];

const PLANS: Array<{
  key: PlanKey;
  label: string;
  price: { monthly: string; yearly?: string };
  highlight?: boolean;
}> = [
  { key: "demo", label: "Demo", price: { monthly: "Gratis" } },
  { key: "base", label: "Base", price: { monthly: "€59/mese", yearly: "€649/anno (-8%)" } },
  { key: "pro", label: "Pro", price: { monthly: "€159/mese", yearly: "€1.719/anno (-10%)" }, highlight: true },
  { key: "enterprise", label: "Enterprise", price: { monthly: "Custom" } },
];

interface BenefitRow {
  label: string;
  values: Record<PlanKey, string | boolean>;
}

const BP_BENEFITS: BenefitRow[] = [
  { label: "Run / mese", values: { demo: "1", base: "3", pro: "10", enterprise: "Illimitate" } },
  { label: "Modelli AI per run", values: { demo: "1", base: "2", pro: "4", enterprise: "6" } },
  { label: "Radar 5 pilastri", values: { demo: true, base: true, pro: true, enterprise: true } },
  { label: "Insight LLM (Claude Sonnet)", values: { demo: true, base: true, pro: true, enterprise: true } },
  { label: "Diagnostica cross-tool con Citability", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Storico run filtrabile", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Confronto run (overlay radar)", values: { demo: false, base: false, pro: true, enterprise: true } },
  { label: "Time-series score nel tempo", values: { demo: false, base: false, pro: false, enterprise: true } },
  { label: "Export PDF", values: { demo: false, base: false, pro: true, enterprise: true } },
];

const CS_BENEFITS: BenefitRow[] = [
  { label: "Audit / ciclo", values: { demo: "1 / mese", base: "10", pro: "50", enterprise: "Illimitati" } },
  { label: "Parametri analizzati", values: { demo: "10", base: "10", pro: "56", enterprise: "56" } },
  { label: "URL per audit", values: { demo: "1", base: "3", pro: "5", enterprise: "Illimitati" } },
  { label: "Motori AI", values: { demo: "ChatGPT, Gemini", base: "3 motori", pro: "7 motori", enterprise: "7 motori" } },
  { label: "Analisi What-If", values: { demo: false, base: false, pro: true, enterprise: true } },
  { label: "Export PDF & Excel", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Storico analisi", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Filtro per AI", values: { demo: false, base: false, pro: true, enterprise: true } },
  { label: "Consulenza dedicata", values: { demo: false, base: false, pro: false, enterprise: true } },
];

const AVI_BENEFITS: BenefitRow[] = [
  { label: "Prompt con web search", values: { demo: "0", base: "30", pro: "90", enterprise: "Illimitati" } },
  { label: "Prompt senza web search", values: { demo: "40", base: "100", pro: "210", enterprise: "Illimitati" } },
  { label: "Modelli AI per progetto", values: { demo: "2 (fissi)", base: "3", pro: "5", enterprise: "7" } },
  { label: "Confronti competitor", values: { demo: false, base: false, pro: "10 / mese", enterprise: "Illimitati" } },
  { label: "Discovery competitor automatica", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Generazione query AI", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Estrazione fonti & topic", values: { demo: false, base: true, pro: true, enterprise: true } },
  { label: "Accesso al dataset di confronto", values: { demo: false, base: false, pro: true, enterprise: true } },
];

const TOOL_BENEFITS: Record<ToolKey, BenefitRow[]> = {
  bp: BP_BENEFITS,
  cs: CS_BENEFITS,
  avi: AVI_BENEFITS,
};

const TOOL_DESC: Record<ToolKey, string> = {
  bp: "La forma del tuo brand secondo le AI: 5 pilastri, un radar, insight actionable.",
  cs: "Quanto il tuo sito è citabile dalle AI: 56 parametri tecnici, 7 motori, 6 paesi.",
  avi: "La visibilità reale del tuo brand sui motori AI: prompt, competitor, fonti.",
};

function formatValue(v: string | boolean): JSX.Element {
  if (v === true) return <Check className="w-4 h-4 text-primary inline" />;
  if (v === false) return <span className="text-muted-foreground/50">—</span>;
  return <span>{v}</span>;
}

export function PianoClient({ plan, planExpires }: { plan: string; planExpires: string | null }) {
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState<ToolKey>("bp");

  const planLower = (plan ?? "demo").toLowerCase();
  const isFreeOrDemo = planLower === "demo" || planLower === "free";
  const currentPlan: PlanKey = isFreeOrDemo
    ? "demo"
    : (["base", "pro", "enterprise"].includes(planLower) ? (planLower as PlanKey) : "demo");

  return (
    <>
      <div>
        <Link
          href="/brand-profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Torna a Brand Profile
        </Link>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          Il tuo piano
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Il piano è unico e include Brand Profile, Citability Score e AI Visibility Index.
        </p>
      </div>

      {/* Current plan banner */}
      <div className="card p-5 border-primary/30 bg-primary/[0.04] flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {isFreeOrDemo ? (
            <Sparkles className="w-8 h-8 text-primary" />
          ) : (
            <CreditCard className="w-8 h-8 text-primary" />
          )}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Piano attuale</div>
            <div className="text-2xl font-display font-semibold text-foreground capitalize">{currentPlan}</div>
            {planExpires && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Scadenza: {planExpires.slice(0, 10)}
              </div>
            )}
          </div>
        </div>
        {isFreeOrDemo && (
          <a
            href="https://suite.citationrate.com/piano"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Passa a Base
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Plan cards row (price/feature highlight) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map((p) => {
          const isCurrent = p.key === currentPlan;
          return (
            <div
              key={p.key}
              className={`card p-5 ${
                isCurrent
                  ? "border-primary bg-primary/[0.04]"
                  : p.highlight
                    ? "border-primary/40"
                    : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-lg font-semibold text-foreground">{p.label}</div>
                {isCurrent && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] border border-primary text-primary bg-primary/10">
                    Attuale
                  </span>
                )}
              </div>
              <div className="text-xl font-display font-bold text-foreground">{p.price.monthly}</div>
              {p.price.yearly && (
                <div className="text-xs text-muted-foreground mt-0.5">{p.price.yearly}</div>
              )}
              {p.key === "enterprise" ? (
                <a
                  href="mailto:citationrate@gmail.com?subject=Richiesta%20piano%20Enterprise"
                  className="mt-4 block text-center text-xs px-3 py-1.5 rounded-[2px] border border-border text-foreground hover:bg-surface-2 transition-colors"
                >
                  Richiedi Enterprise
                </a>
              ) : !isCurrent ? (
                <a
                  href={`https://suite.citationrate.com/piano?upgrade=${p.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block text-center text-xs px-3 py-1.5 rounded-[2px] border border-primary text-primary hover:bg-primary/10 transition-colors"
                >
                  Passa a {p.label}
                </a>
              ) : (
                <div className="mt-4 text-center text-xs text-muted-foreground py-1.5">
                  Sei già su questo piano
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tool tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-border">
          {TOOLS.map((tool) => {
            const Icon = tool.Icon;
            const isActive = tool.key === activeTool;
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => setActiveTool(tool.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-r border-border last:border-r-0 transition-colors ${
                  isActive
                    ? "bg-primary/[0.06] text-primary border-b-2 border-b-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{TOOL_DESC[activeTool]}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Caratteristica
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      className={`text-center p-3 font-mono text-xs uppercase tracking-wider ${
                        p.key === currentPlan ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOOL_BENEFITS[activeTool].map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="p-3 text-foreground">{row.label}</td>
                    {PLANS.map((p) => (
                      <td
                        key={p.key}
                        className={`p-3 text-center text-sm ${
                          p.key === currentPlan ? "text-foreground font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {formatValue(row.values[p.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Per pagamenti, fatturazione e gestione abbonamento vai su{" "}
        <a
          href="https://suite.citationrate.com/piano"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          suite.citationrate.com/piano
        </a>
      </div>
    </>
  );
}

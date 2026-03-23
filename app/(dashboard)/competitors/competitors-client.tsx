"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Trophy, Users, Sparkles, Crown,
  Loader2, X, Tag, BarChart3, MessageSquareQuote,
  Check, Info,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useUsage } from "@/lib/hooks/useUsage";

const MODEL_LABELS: Record<string, string> = {
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "gpt-5.4": "GPT-5.4",
  "o1-mini": "o1 Mini",
  "o3-mini": "o3 Mini",
  "o3": "o3",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "perplexity-sonar": "Perplexity Sonar",
  "perplexity-sonar-pro": "Perplexity Sonar Pro",
  "claude-haiku": "Claude Haiku 4.5",
  "claude-sonnet": "Claude Sonnet 4.6",
  "claude-opus": "Claude Opus 4.6",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-opus-4-5": "Claude Opus 4.5",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
  "grok-2": "Grok 2",
  "copilot-gpt4": "Copilot GPT-4",
};

function getModelDisplayName(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

/* ─── Types ─── */
interface MacroTheme {
  theme: string;
  description: string;
  keywords: string[];
  frequency: number;
  excerpts?: string[];
}

interface ThemeAnalysis {
  macro_themes?: MacroTheme[];
  positioning_summary?: string;
}

interface CompRow {
  name: string;
  projects: { id: string; name: string; brand: string }[];
  mentions: number;
  analysisCount: number;
  topics: string[];
  queryTypes: string[];
  avgSentiment: number | null;
  firstSeen: string;
  lastSeen: string;
  themeAnalysis: ThemeAnalysis | null;
  aviScore: number | null;
  mentionScore: number | null;
  competitorType: string;
  modelMentions: Record<string, boolean>;
}

const COMP_TYPE_STYLE: Record<string, { border: string; text: string }> = {
  direct:     { border: "border-primary/30",     text: "text-primary" },
  indirect:   { border: "border-[#c4a882]/30",   text: "text-[#c4a882]" },
  channel:    { border: "border-[#7eb3d4]/30",   text: "text-[#7eb3d4]" },
  aggregator: { border: "border-[#e8956d]/30",   text: "text-[#e8956d]" },
};

const COMP_TYPE_KEYS: Record<string, string> = {
  direct: "competitors.typeDirect",
  indirect: "competitors.typeIndirect",
  channel: "competitors.typeChannel",
  aggregator: "competitors.typeAggregator",
};

/* ─── Helpers ─── */
const FUNNEL_LABELS: Record<string, { text: string; cls: string }> = {
  tofu: { text: "TOFU", cls: "badge-primary" },
  mofu: { text: "MOFU", cls: "badge-success" },
  bofu: { text: "BOFU", cls: "badge badge-muted" },
};

const FREQ_COLORS = [
  "bg-primary/20", "bg-primary/30", "bg-primary/40", "bg-primary/50",
  "bg-primary/60", "bg-primary/70", "bg-primary/75", "bg-primary/80",
  "bg-primary/85", "bg-primary/90",
];

/* ─── Main Client ─── */
export function CompetitorsClient({
  rows,
  projectIds,
  brandAviScore,
  availableModels,
  selectedModel,
}: {
  rows: CompRow[];
  projectIds: string[];
  brandAviScore?: number | null;
  availableModels?: string[];
  selectedModel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [drawerTheme, setDrawerTheme] = useState<{ compName: string; theme: MacroTheme } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const usage = useUsage();
  const isPro = usage.isPro;
  const [showProGate, setShowProGate] = useState(false);

  const filteredRows = typeFilter ? rows.filter((r) => r.competitorType === typeFilter) : rows;

  async function analyzeContexts() {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      for (const pid of projectIds) {
        const res = await fetch("/api/competitors/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: pid }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || t("common.error"));
        }
      }
      router.refresh();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : t("competitors.analysisError"));
    } finally {
      setAnalyzing(false);
    }
  }

  const hasAnyAnalysis = rows.some((r) => r.themeAnalysis?.macro_themes?.length);

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">{t("competitors.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} {t("competitors.foundInTopics")} {new Set(rows.flatMap((r) => r.topics)).size} topic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Analyze button (Pro only) */}
          {rows.length > 0 && (
            <div className="relative">
              <button
                data-tour="analyze-contexts-btn"
                onClick={() => {
                  if (!isPro) { setShowProGate(true); return; }
                  if (usage.contextAnalysesRemaining <= 0) { setAnalyzeError(t("competitors.contextLimitReached")); return; }
                  analyzeContexts();
                }}
                disabled={analyzing || (isPro && usage.contextAnalysesRemaining <= 0)}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-[2px] transition-colors disabled:opacity-50 ${
                  isPro
                    ? "bg-primary text-primary-foreground hover:bg-primary/85"
                    : "bg-[#c4a882]/20 text-[#c4a882] border border-[#c4a882]/30 cursor-default"
                }`}
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? t("competitors.analyzingContexts") : t("competitors.analyzeContexts")}
                {isPro && !analyzing && (
                  <span className="text-xs font-normal opacity-70 ml-1">({usage.contextAnalysesRemaining}/{usage.contextAnalysesLimit})</span>
                )}
                {!isPro && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px] ml-1">
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </button>
              {showProGate && !isPro && (
                <div className="absolute right-0 top-full mt-2 z-30 w-64 p-3 rounded-[2px] border border-[#c4a882]/30 bg-[#111416] shadow-xl text-sm">
                  <p className="text-foreground font-medium mb-1">{t("competitors.proRequired")}</p>
                  <p className="text-muted-foreground text-xs mb-2">{t("competitors.proDesc")}</p>
                  <div className="flex items-center justify-between">
                    <a href="/settings#piano" className="text-[#c4a882] text-xs font-semibold hover:text-[#c4a882]/80 transition-colors">{t("settings.upgradePro")} &rarr;</a>
                    <button onClick={() => setShowProGate(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t("common.close")}</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Model filter pills */}
      {(availableModels ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("model");
              router.push(`${pathname}?${params.toString()}`);
            }}
            className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
            style={
              !selectedModel
                ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
            }
          >
            {t("common.all")}
          </button>
          {(availableModels ?? []).map((model) => (
            <button
              key={model}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("model", model);
                router.push(`${pathname}?${params.toString()}`);
              }}
              className="font-mono text-[0.75rem] tracking-wide px-3 py-1.5 rounded-full border transition-colors"
              style={
                selectedModel === model
                  ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                  : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
              }
            >
              {getModelDisplayName(model)}
            </button>
          ))}
        </div>
      )}

      {/* Competitor type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className="font-mono text-[0.75rem] tracking-wide uppercase px-3 py-1.5 rounded-full border transition-colors"
          style={
            !typeFilter
              ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
              : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
          }
        >
          {t("common.all")}
        </button>
        {Object.keys(COMP_TYPE_STYLE).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className="font-mono text-[0.75rem] tracking-wide uppercase px-3 py-1.5 rounded-full border transition-colors"
            style={
              typeFilter === type
                ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
            }
          >
            {t(COMP_TYPE_KEYS[type])}
          </button>
        ))}
      </div>

      {/* Model variation note */}
      {(availableModels ?? []).length > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>{t("competitors.modelVariation")}</span>
        </div>
      )}

      {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}

      {filteredRows.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("competitors.noCompetitorYet")}</p>
        </div>
      ) : (
        <>
          {/* Benchmark vs Brand */}
          {brandAviScore != null && filteredRows.length > 0 && (() => {
            const top5 = filteredRows.slice(0, 5);
            return (
              <div className="card p-5 space-y-4">
                <h2 className="font-display font-semibold text-foreground text-sm">Benchmark</h2>
                <div className="space-y-2.5">
                  {/* Brand row */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary w-32 truncate">{t("competitors.yourBrand")}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-[2px] overflow-hidden">
                      <div
                        className="h-full rounded-[2px] transition-all duration-700"
                        style={{ width: `${(brandAviScore / 100) * 100}%`, background: "#7eb89a" }}
                      />
                    </div>
                    <span className="text-xs font-bold text-primary w-14 text-right">AVI {Math.round(brandAviScore * 10) / 10}</span>
                  </div>
                  {/* Competitor rows */}
                  {top5.map((r) => {
                    const score = r.aviScore ?? r.mentionScore ?? 0;
                    const isEstimate = r.aviScore == null && r.mentionScore != null;
                    const beats = score > brandAviScore;
                    const barBg = score >= 70 ? "rgba(126,184,154,0.5)" : score >= 40 ? "rgba(232,226,214,0.3)" : "rgba(192,97,74,0.3)";
                    const textColor = beats ? "text-destructive" : score >= 70 ? "text-primary" : score >= 40 ? "text-cream" : "text-destructive";
                    return (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground w-32 truncate">{r.name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-[2px] overflow-hidden">
                          <div
                            className="h-full rounded-[2px] transition-all duration-700"
                            style={{ width: `${(Math.min(score, 100) / 100) * 100}%`, background: barBg }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-14 text-right ${score > 0 ? textColor : "text-muted-foreground"}`}>
                          {score > 0 ? `${isEstimate ? "" : "AVI "}${Math.round(score * 10) / 10}${isEstimate ? "%" : ""}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <CompetitorView rows={filteredRows} onThemeClick={(compName, theme) => setDrawerTheme({ compName, theme })} />
        </>
      )}

      {/* Theme Drawer */}
      {drawerTheme && (
        <ThemeDrawer
          compName={drawerTheme.compName}
          theme={drawerTheme.theme}
          onClose={() => setDrawerTheme(null)}
        />
      )}
    </div>
  );
}

/* ─── Per Competitor View ─── */
function CompetitorView({
  rows,
  onThemeClick,
}: {
  rows: CompRow[];
  onThemeClick: (compName: string, theme: MacroTheme) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((row, i) => (
        <CompetitorCard key={row.name} row={row} rank={i + 1} onThemeClick={onThemeClick} />
      ))}
    </div>
  );
}

function CompetitorCard({
  row,
  rank,
  onThemeClick,
}: {
  row: CompRow;
  rank: number;
  onThemeClick: (compName: string, theme: MacroTheme) => void;
}) {
  const { t } = useTranslation();
  const themes = row.themeAnalysis?.macro_themes ?? [];
  const summary = row.themeAnalysis?.positioning_summary;

  return (
    <div className="card p-5 space-y-3 hover:border-primary/30 transition-colors">
      {/* Top: name + mentions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-[2px] bg-primary/10 text-primary text-xs font-bold shrink-0">
            {rank}
          </span>
          <h3 className="font-display font-bold text-lg text-foreground">{row.name}</h3>
          {(() => {
            const style = COMP_TYPE_STYLE[row.competitorType];
            const key = COMP_TYPE_KEYS[row.competitorType];
            return style && key ? (
              <span className={`font-mono text-[0.69rem] tracking-wide uppercase px-1.5 py-0.5 rounded-[2px] border ${style.border} ${style.text}`}>
                {t(key)}
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex items-center gap-2">
          {row.aviScore != null && (
            <span className={`font-display font-bold text-sm px-2 py-0.5 rounded-[2px] ${
              row.aviScore >= 70 ? "bg-success/10 text-success" : row.aviScore >= 40 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"
            }`}>
              AVI {Math.round(row.aviScore * 10) / 10}
            </span>
          )}
          <span className="badge badge-primary font-display font-bold">
            {row.mentions} {t("competitors.citations")}
          </span>
        </div>
      </div>

      {/* Per-model discovery badges */}
      {row.modelMentions && Object.keys(row.modelMentions).length > 1 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(row.modelMentions).map(([model, found]) => (
            <span
              key={model}
              className={`inline-flex items-center gap-1 font-mono text-[0.69rem] tracking-wide px-1.5 py-0.5 rounded-[2px] border ${
                found
                  ? "border-primary/30 text-primary bg-primary/5"
                  : "border-border text-muted-foreground/50 bg-muted/30"
              }`}
            >
              {found ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
              {model.replace(/^(gpt-|claude-|gemini-|grok-)/, (m) => m).split("-").slice(0, 2).join("-")}
            </span>
          ))}
        </div>
      )}

      {/* Positioning summary */}
      {summary && (
        <p className="text-sm text-muted-foreground italic leading-relaxed">{summary}</p>
      )}

      {/* Macro themes */}
      {themes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("competitors.citedInContexts")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((t) => (
              <button
                key={t.theme}
                onClick={() => onThemeClick(row.name, t)}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-[2px] bg-muted/50 border border-border hover:border-primary/40 transition-all cursor-pointer"
              >
                <BarChart3 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {t.theme}
                </span>
                {/* Frequency bar */}
                <span className="flex gap-px ml-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1 h-3 rounded-[2px] ${
                        i < Math.ceil(t.frequency / 2) ? "bg-primary" : "bg-border"
                      }`}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topics (original) */}
      {row.topics.length > 0 && themes.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.topics.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-[2px] text-[13px] font-medium bg-primary/10 text-primary border border-primary/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Query type + sentiment + analysis count */}
      <div className="flex items-center gap-3 flex-wrap">
        {row.queryTypes.map((qt) => {
          const f = FUNNEL_LABELS[qt];
          return f ? (
            <span key={qt} className={`badge ${f.cls}`}>{f.text}</span>
          ) : (
            <span key={qt} className="badge badge-muted">{qt.toUpperCase()}</span>
          );
        })}

        <span className="text-xs text-muted-foreground">
          {row.analysisCount} {t("competitors.analyses")}
        </span>
      </div>

      {/* Dates + project */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-[13px] text-muted-foreground">
        <div className="flex gap-4">
          <span>{t("competitors.firstSeen")} {row.firstSeen ? new Date(row.firstSeen).toLocaleDateString("it-IT") : "\u2014"}</span>
          <span>{t("competitors.lastSeen")} {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString("it-IT") : "\u2014"}</span>
        </div>
        {row.projects.length > 0 && (
          <span className="text-right truncate max-w-[160px]">
            {row.projects.map((p) => p.brand || p.name).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Theme Detail Drawer ─── */
function ThemeDrawer({
  compName,
  theme,
  onClose,
}: {
  compName: string;
  theme: MacroTheme;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-[hsl(var(--surface))] border-l border-border z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">{theme.theme}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("competitors.contextFor")} <span className="text-primary font-medium">{compName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t("competitors.description")}</h4>
            <p className="text-sm text-foreground leading-relaxed">{theme.description}</p>
          </div>

          {/* Frequency */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t("competitors.frequency")}</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-border rounded-[2px] overflow-hidden">
                <div
                  className="h-full bg-primary rounded-[2px] transition-all"
                  style={{ width: `${(theme.frequency / 10) * 100}%` }}
                />
              </div>
              <span className="text-sm font-display font-bold text-primary">{theme.frequency}/10</span>
            </div>
          </div>

          {/* Keywords */}
          {theme.keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> {t("competitors.keywords")}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {theme.keywords.map((kw) => (
                  <span key={kw} className="px-2.5 py-1 rounded-[2px] text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Excerpts */}
          {theme.excerpts && theme.excerpts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageSquareQuote className="w-3 h-3" /> {t("competitors.aiExamples")}
              </h4>
              <div className="space-y-2.5">
                {theme.excerpts.map((excerpt, i) => (
                  <div key={i} className="relative pl-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/80 leading-relaxed italic">
                      &ldquo;{excerpt}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!theme.excerpts || theme.excerpts.length === 0) && (
            <div className="card p-4 border-border text-center">
              <p className="text-xs text-muted-foreground">
                {t("competitors.noExtracts")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

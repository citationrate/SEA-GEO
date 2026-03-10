"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Users, LayoutList, LayoutGrid, Sparkles,
  Loader2, X, Tag, BarChart3, MessageSquareQuote,
} from "lucide-react";

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
}

interface TopicGroup {
  topic: string;
  competitors: string[];
}

/* ─── Helpers ─── */
function sentimentLabel(s: number | null): { text: string; cls: string } {
  if (s == null) return { text: "N/D", cls: "text-muted-foreground" };
  if (s >= 0.6) return { text: "Positivo", cls: "text-success" };
  if (s >= 0.4) return { text: "Neutro", cls: "text-muted-foreground" };
  return { text: "Negativo", cls: "text-destructive" };
}

function sentimentDot(s: number | null): string {
  if (s == null) return "bg-muted-foreground";
  if (s >= 0.6) return "bg-success";
  if (s >= 0.4) return "bg-muted-foreground";
  return "bg-destructive";
}

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
  topicGroups,
  projectIds,
  brandAviScore,
  availableModels,
  selectedModel,
}: {
  rows: CompRow[];
  topicGroups: TopicGroup[];
  projectIds: string[];
  brandAviScore?: number | null;
  availableModels?: string[];
  selectedModel?: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"competitor" | "ambito">("competitor");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [drawerTheme, setDrawerTheme] = useState<{ compName: string; theme: MacroTheme } | null>(null);

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
          throw new Error(data.error || "Errore");
        }
      }
      router.refresh();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Errore durante l'analisi");
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
            <h1 className="font-display font-bold text-2xl text-foreground">Competitor</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} competitor individuati in {new Set(rows.flatMap((r) => r.topics)).size} topic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Analyze button */}
          {rows.length > 0 && (
            <button
              onClick={analyzeContexts}
              disabled={analyzing}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3.5 py-2 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? "Analisi in corso..." : "Analizza Contesti con AI"}
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-[2px] p-0.5">
            <button
              onClick={() => setView("competitor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium transition-colors ${
                view === "competitor" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Per Competitor
            </button>
            <button
              onClick={() => setView("ambito")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-medium transition-colors ${
                view === "ambito" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Per Ambito
            </button>
          </div>
        </div>
      </div>

      {/* Model filter pills */}
      {(availableModels ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.delete("model");
              router.push(`?${params.toString()}`);
            }}
            className="font-mono text-[0.6rem] tracking-wide uppercase px-3 py-1.5 rounded-full border transition-colors"
            style={
              !selectedModel
                ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
            }
          >
            Tutti
          </button>
          {(availableModels ?? []).map((model) => (
            <button
              key={model}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("model", model);
                router.push(`?${params.toString()}`);
              }}
              className="font-mono text-[0.6rem] tracking-wide uppercase px-3 py-1.5 rounded-full border transition-colors"
              style={
                selectedModel === model
                  ? { borderColor: "#7eb89a", backgroundColor: "rgba(126,184,154,0.1)", color: "#7eb89a" }
                  : { borderColor: "rgba(255,255,255,0.07)", color: "#9d9890" }
              }
            >
              {model}
            </button>
          ))}
        </div>
      )}

      {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessun competitor trovato. Lancia un&apos;analisi per scoprirli.</p>
        </div>
      ) : view === "competitor" ? (
        <>
          {/* Benchmark vs Brand */}
          {brandAviScore != null && rows.length > 0 && (() => {
            const top5 = rows.slice(0, 5);
            return (
              <div className="card p-5 space-y-4">
                <h2 className="font-display font-semibold text-foreground text-sm">Benchmark</h2>
                <div className="space-y-2.5">
                  {/* Brand row */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary w-32 truncate">Il tuo brand</span>
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
                    const score = r.aviScore ?? 0;
                    const beats = score > brandAviScore;
                    const barBg = score >= 70 ? "rgba(126,184,154,0.5)" : score >= 40 ? "rgba(232,226,214,0.3)" : "rgba(192,97,74,0.3)";
                    const textColor = beats ? "text-destructive" : score >= 70 ? "text-primary" : score >= 40 ? "text-cream" : "text-destructive";
                    return (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground w-32 truncate">{r.name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-[2px] overflow-hidden">
                          <div
                            className="h-full rounded-[2px] transition-all duration-700"
                            style={{ width: `${(score / 100) * 100}%`, background: barBg }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-14 text-right ${score > 0 ? textColor : "text-muted-foreground"}`}>
                          {score > 0 ? `AVI ${Math.round(score * 10) / 10}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <CompetitorView rows={rows} onThemeClick={(compName, theme) => setDrawerTheme({ compName, theme })} />
        </>
      ) : (
        <AmbitoView topicGroups={topicGroups} rows={rows} />
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
  const sentiment = sentimentLabel(row.avgSentiment);
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
            {row.mentions} citazioni
          </span>
        </div>
      </div>

      {/* Positioning summary */}
      {summary && (
        <p className="text-sm text-muted-foreground italic leading-relaxed">{summary}</p>
      )}

      {/* Macro themes */}
      {themes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Citato in contesti di:
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
            <span key={t} className="px-2 py-0.5 rounded-[2px] text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
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

        <span className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${sentimentDot(row.avgSentiment)}`} />
          <span className={sentiment.cls}>{sentiment.text}</span>
        </span>

        <span className="text-xs text-muted-foreground">
          {row.analysisCount} analisi
        </span>
      </div>

      {/* Dates + project */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
        <div className="flex gap-4">
          <span>Prima: {row.firstSeen ? new Date(row.firstSeen).toLocaleDateString("it-IT") : "\u2014"}</span>
          <span>Ultima: {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString("it-IT") : "\u2014"}</span>
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

/* ─── Per Ambito View ─── */
function AmbitoView({ topicGroups, rows }: { topicGroups: TopicGroup[]; rows: CompRow[] }) {
  const rowMap = new Map(rows.map((r) => [r.name, r]));

  return (
    <div className="space-y-4">
      {topicGroups.map((group) => (
        <div key={group.topic} className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              {group.topic}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.competitors.length} competitor
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.competitors.map((name) => {
              const comp = rowMap.get(name);
              return (
                <div key={name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] bg-muted/50 border border-border hover:border-primary/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {comp?.mentions ?? 0}x
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${sentimentDot(comp?.avgSentiment ?? null)}`} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {topicGroups.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nessun topic associato ai competitor.</p>
        </div>
      )}
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
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-[hsl(var(--surface))] border-l border-border z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">{theme.theme}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contesto per <span className="text-primary font-medium">{compName}</span>
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
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Descrizione</h4>
            <p className="text-sm text-foreground leading-relaxed">{theme.description}</p>
          </div>

          {/* Frequency */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Frequenza</h4>
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
                <Tag className="w-3 h-3" /> Keywords
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
                <MessageSquareQuote className="w-3 h-3" /> Esempi dalle risposte AI
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
                Nessun estratto disponibile. Esegui &quot;Analizza Contesti con AI&quot; per generare gli estratti.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

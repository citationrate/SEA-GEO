"use client";

import { useState } from "react";
import { Trophy, Users, LayoutList, LayoutGrid } from "lucide-react";

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
}

interface TopicGroup {
  topic: string;
  competitors: string[];
}

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

export function CompetitorsClient({ rows, topicGroups }: { rows: CompRow[]; topicGroups: TopicGroup[] }) {
  const [view, setView] = useState<"competitor" | "ambito">("competitor");

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Competitor</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} competitor individuati in {new Set(rows.flatMap((r) => r.topics)).size} topic
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView("competitor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "competitor" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> Per Competitor
          </button>
          <button
            onClick={() => setView("ambito")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "ambito" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Per Ambito
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessun competitor trovato. Lancia un&apos;analisi per scoprirli.</p>
        </div>
      ) : view === "competitor" ? (
        <CompetitorView rows={rows} />
      ) : (
        <AmbitoView topicGroups={topicGroups} rows={rows} />
      )}
    </div>
  );
}

/* ─── Per Competitor View ─── */
function CompetitorView({ rows }: { rows: CompRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((row, i) => (
        <CompetitorCard key={row.name} row={row} rank={i + 1} />
      ))}
    </div>
  );
}

function CompetitorCard({ row, rank }: { row: CompRow; rank: number }) {
  const sentiment = sentimentLabel(row.avgSentiment);

  return (
    <div className="card p-5 space-y-3 hover:border-primary/30 transition-colors">
      {/* Top row: name + mentions badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
            {rank}
          </span>
          <h3 className="font-display font-bold text-lg text-foreground">{row.name}</h3>
        </div>
        <span className="badge badge-primary font-display font-bold">
          {row.mentions} citazioni
        </span>
      </div>

      {/* Topics chips */}
      {row.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.topics.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
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
          {row.analysisCount} {row.analysisCount === 1 ? "analisi" : "analisi"}
        </span>
      </div>

      {/* Bottom: dates + project */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
        <div className="flex gap-4">
          <span>
            Prima citazione: {row.firstSeen ? new Date(row.firstSeen).toLocaleDateString("it-IT") : "\u2014"}
          </span>
          <span>
            Ultima: {row.lastSeen ? new Date(row.lastSeen).toLocaleDateString("it-IT") : "\u2014"}
          </span>
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
              const sentiment = sentimentLabel(comp?.avgSentiment ?? null);
              return (
                <div key={name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors">
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

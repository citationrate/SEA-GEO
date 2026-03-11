"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Swords, Trophy, Eye, BarChart3, Loader2, MessageSquare } from "lucide-react";

interface Analysis {
  id: string;
  brand_a: string;
  brand_b: string;
  driver: string;
  status: string;
  win_rate_a: number | null;
  win_rate_b: number | null;
  fmr_a: number | null;
  fmr_b: number | null;
  comp_score_a: number | null;
  created_at: string;
}

interface Prompt {
  id: string;
  pattern_type: string;
  query_text: string;
  model: string;
  run_number: number;
  response_text: string | null;
  recommendation: number | null;
  first_mention: string | null;
  key_arguments: string[] | null;
  status: string;
}

function compScoreLabel(score: number | null): { text: string; cls: string } {
  if (score == null) return { text: "—", cls: "text-muted-foreground" };
  if (score >= 60) return { text: "Dominante", cls: "text-primary" };
  if (score >= 40) return { text: "Competitivo", cls: "text-[#c4a882]" };
  return { text: "Svantaggiato", cls: "text-destructive" };
}

function recLabel(rec: number | null, brandA: string, brandB: string): { text: string; cls: string } {
  if (rec === 1) return { text: brandA, cls: "text-primary" };
  if (rec === 2) return { text: brandB, cls: "text-destructive" };
  if (rec === 0.5) return { text: "Pareggio", cls: "text-[#c4a882]" };
  return { text: "Nessuno", cls: "text-muted-foreground" };
}

function fmLabel(fm: string | null, brandA: string, brandB: string): string {
  if (fm === "A") return brandA;
  if (fm === "B") return brandB;
  return "Pareggio";
}

export function CompetitiveResults({
  analysis,
  prompts,
}: {
  analysis: Analysis;
  prompts: Prompt[];
}) {
  const router = useRouter();
  const a = analysis;
  const isRunning = a.status === "running" || a.status === "pending";
  const label = compScoreLabel(a.comp_score_a);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [isRunning, router]);

  const argCounts = new Map<string, number>();
  for (const p of prompts) {
    for (const arg of p.key_arguments ?? []) {
      const key = arg.toLowerCase().trim();
      argCounts.set(key, (argCounts.get(key) ?? 0) + 1);
    }
  }
  const topArgs = Array.from(argCounts.entries())
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href="/compare"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al confronto
        </a>
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              {a.brand_a} vs {a.brand_b}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Driver: {a.driver} &middot; {new Date(a.created_at).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="card p-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Analisi in corso... {prompts.filter((p) => p.status === "completed").length}/{prompts.length} risposte
          </p>
        </div>
      )}

      {a.status === "completed" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {/* Win Rate */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Win Rate</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_a}</span>
                  <span className="text-sm font-bold text-primary">{a.win_rate_a ?? 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-[2px] overflow-hidden flex">
                  <div
                    className="h-full rounded-l-[2px] transition-all duration-700"
                    style={{ width: `${a.win_rate_a ?? 0}%`, background: "#7eb89a" }}
                  />
                  <div
                    className="h-full rounded-r-[2px] transition-all duration-700"
                    style={{ width: `${a.win_rate_b ?? 0}%`, background: "rgba(192,97,74,0.6)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_b}</span>
                  <span className="text-sm font-bold text-destructive">{a.win_rate_b ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* First Mention Rate */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Mention</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_a}</span>
                  <span className="text-sm font-bold text-primary">{a.fmr_a ?? 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-[2px] overflow-hidden flex">
                  <div
                    className="h-full rounded-l-[2px] transition-all duration-700"
                    style={{ width: `${a.fmr_a ?? 0}%`, background: "#7eb89a" }}
                  />
                  <div
                    className="h-full rounded-r-[2px] transition-all duration-700"
                    style={{ width: `${a.fmr_b ?? 0}%`, background: "rgba(192,97,74,0.6)" }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.brand_b}</span>
                  <span className="text-sm font-bold text-destructive">{a.fmr_b ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* CompScore */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">CompScore</h3>
              </div>
              <div className="text-center pt-1">
                <p className={`font-display font-bold text-4xl ${label.cls}`}>
                  {a.comp_score_a != null ? Math.round(a.comp_score_a) : "—"}
                </p>
                <p className={`text-sm font-medium mt-1 ${label.cls}`}>{label.text}</p>
              </div>
            </div>
          </div>

          {topArgs.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Argomenti principali usati dall&apos;AI
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {topArgs.map(([arg, count]) => (
                  <span
                    key={arg}
                    className="px-3 py-1.5 rounded-[2px] text-sm bg-muted/50 border border-border text-foreground"
                  >
                    {arg}
                    <span className="ml-1.5 text-xs text-muted-foreground">&times;{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Dettaglio risposte ({prompts.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Pattern</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Modello</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Run</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Anteprima</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Preferenza</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">1a Menzione</th>
                  </tr>
                </thead>
                <tbody>
                  {prompts.map((p) => {
                    const rec = recLabel(p.recommendation, a.brand_a, a.brand_b);
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="badge badge-primary text-[10px]">{p.pattern_type}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.model}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">#{p.run_number}</td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <p className="text-foreground truncate text-xs">
                            {p.response_text?.substring(0, 120) ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold ${rec.cls}`}>{rec.text}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {fmLabel(p.first_mention, a.brand_a, a.brand_b)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {a.status === "failed" && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-destructive font-medium">Analisi fallita</p>
          <p className="text-sm text-muted-foreground">Si è verificato un errore durante l&apos;elaborazione.</p>
        </div>
      )}
    </div>
  );
}

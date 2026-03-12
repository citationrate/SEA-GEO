"use client";

import { useState, useEffect, useMemo } from "react";
import { Database, ChevronDown, X, Loader2, ExternalLink } from "lucide-react";

interface Project {
  id: string;
  name: string;
  brand: string;
}

interface Run {
  id: string;
  version: number;
  status: string;
  created_at: string;
}

interface PromptRow {
  id: string;
  query_id: string;
  query_text: string;
  funnel_stage: string;
  set_type: string;
  layer: string | null;
  persona_mode: string | null;
  model: string;
  run_number: number;
  raw_response: string | null;
  executed_at: string | null;
  error: string | null;
  // analysis fields
  brand_mentioned: boolean | null;
  brand_rank: number | null;
  sentiment_score: number | null;
  competitors_found: string[] | null;
  sources: { url: string; domain: string; label?: string; source_type: string }[];
}

const MODEL_LABELS: Record<string, string> = {
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "o1-mini": "o1 Mini",
  "o3-mini": "o3 Mini",
  "o3": "o3",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "perplexity-sonar": "Perplexity Sonar",
  "perplexity-sonar-pro": "Perplexity Sonar Pro",
  "claude-haiku": "Claude Haiku",
  "claude-sonnet": "Claude Sonnet",
  "claude-opus": "Claude Opus",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
};

const SET_TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  generale: { label: "Generale", cls: "border-muted-foreground/30 text-muted-foreground bg-muted-foreground/5" },
  verticale: { label: "Verticale", cls: "border-blue-500/30 text-blue-400 bg-blue-500/5" },
  persona: { label: "Persona", cls: "border-purple-500/30 text-purple-400 bg-purple-500/5" },
  manual: { label: "Manual", cls: "border-border text-muted-foreground" },
};

const FUNNEL_BADGES: Record<string, string> = {
  tofu: "border-primary/30 text-primary",
  mofu: "border-[#7eb89a]/30 text-[#7eb89a]",
};

export function DatasetClient({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [loadingRuns, setLoadingRuns] = useState(false);

  const [rows, setRows] = useState<PromptRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<PromptRow | null>(null);

  // Fetch runs when project changes
  useEffect(() => {
    if (!selectedProject) { setRuns([]); setSelectedRun(""); return; }
    setLoadingRuns(true);
    setSelectedRun("");
    setRows([]);
    fetch(`/api/dataset/runs?project_id=${selectedProject}`)
      .then((r) => r.json())
      .then((data) => setRuns(data))
      .catch(() => setRuns([]))
      .finally(() => setLoadingRuns(false));
  }, [selectedProject]);

  // Fetch prompt rows when run changes
  useEffect(() => {
    if (!selectedRun) { setRows([]); return; }
    setLoadingRows(true);
    fetch(`/api/dataset/prompts?run_id=${selectedRun}`)
      .then((r) => r.json())
      .then((data) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, [selectedRun]);

  // Unique models from current rows
  const models = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.model))).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!selectedModel) return rows;
    return rows.filter((r) => r.model === selectedModel);
  }, [rows, selectedModel]);

  return (
    <div className="space-y-5 max-w-[1400px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Dataset</h1>
          <p className="text-sm text-muted-foreground">Dati raw delle risposte AI — prompt per prompt</p>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="dataset-filters" className="card p-4 flex flex-wrap gap-4 items-end">
        {/* Project */}
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progetto</label>
          <div className="relative">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="input-base w-full appearance-none pr-8"
            >
              <option value="">Seleziona progetto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Run */}
        <div className="space-y-1 min-w-[220px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Analisi</label>
          <div className="relative">
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              disabled={!selectedProject || loadingRuns}
              className="input-base w-full appearance-none pr-8 disabled:opacity-50"
            >
              <option value="">
                {loadingRuns ? "Caricamento..." : runs.length === 0 && selectedProject ? "Nessuna analisi" : "Seleziona analisi..."}
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version} — {new Date(r.created_at).toLocaleDateString("it-IT")} ({r.status})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Model pills */}
        {models.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Modello AI</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedModel(null)}
                className={`text-[11px] px-2.5 py-1 rounded-[2px] border transition-colors ${
                  selectedModel === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Tutti
              </button>
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`text-[11px] px-2.5 py-1 rounded-[2px] border transition-colors ${
                    selectedModel === m
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {MODEL_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count */}
        {rows.length > 0 && (
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredRows.length} / {rows.length} prompt
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedRun && (
        <div className="card p-16 text-center border border-dashed border-border/50">
          <Database className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Seleziona un progetto e un&apos;analisi per visualizzare i dati raw
          </p>
        </div>
      )}

      {/* Loading */}
      {loadingRows && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Table */}
      {!loadingRows && filteredRows.length > 0 && (
        <div data-tour="dataset-table" className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground min-w-[200px]">Query</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Layer</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Famiglia</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Modello</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Run</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Brand</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rank</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sent.</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground min-w-[160px]">Risposta AI</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const stBadge = SET_TYPE_BADGES[row.set_type] || SET_TYPE_BADGES.manual;
                  const funnelCls = FUNNEL_BADGES[row.funnel_stage] || "border-border text-muted-foreground";
                  const response = row.raw_response || "";
                  const truncated = response.length > 120 ? response.slice(0, 120) + "..." : response;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(row)}
                    >
                      <td className="px-3 py-2 max-w-[250px]">
                        <span className="text-foreground line-clamp-2 text-xs">{row.query_text}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono text-[0.5rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${funnelCls}`}>
                          {row.funnel_stage}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-center">
                        {row.layer || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono text-[0.5rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${stBadge.cls}`}>
                          {stBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{MODEL_LABELS[row.model] ?? row.model}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground text-center">
                        #{row.run_number}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.brand_mentioned === true ? (
                          <span className="text-primary font-semibold text-xs">Si</span>
                        ) : row.brand_mentioned === false ? (
                          <span className="text-muted-foreground text-xs">No</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-center">
                        {row.brand_rank != null && row.brand_rank > 0 ? (
                          <span className="text-foreground font-medium">{row.brand_rank}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-center">
                        {row.sentiment_score != null ? (
                          <span className={
                            row.sentiment_score > 0.1 ? "text-primary" :
                            row.sentiment_score < -0.1 ? "text-destructive" :
                            "text-muted-foreground"
                          }>
                            {row.sentiment_score > 0 ? "+" : ""}{row.sentiment_score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-destructive text-[11px]">Errore</span>
                        ) : response ? (
                          <span className="text-muted-foreground text-[11px] line-clamp-2">{truncated}</span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No results after filter */}
      {!loadingRows && selectedRun && filteredRows.length === 0 && rows.length > 0 && (
        <div className="card p-8 text-center">
          <p className="text-muted-foreground text-sm">Nessun prompt per il filtro selezionato</p>
        </div>
      )}

      {/* Expand Modal */}
      {expandedRow && (
        <ExpandModal row={expandedRow} onClose={() => setExpandedRow(null)} />
      )}
    </div>
  );
}

function ExpandModal({ row, onClose }: { row: PromptRow; onClose: () => void }) {
  const stBadge = SET_TYPE_BADGES[row.set_type] || SET_TYPE_BADGES.manual;
  const funnelCls = FUNNEL_BADGES[row.funnel_stage] || "border-border text-muted-foreground";

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface border border-border rounded-[2px] w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-3 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{row.query_text}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`font-mono text-[0.5rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${funnelCls}`}>
                {row.funnel_stage}
              </span>
              <span className={`font-mono text-[0.5rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${stBadge.cls}`}>
                {stBadge.label}
              </span>
              {row.layer && (
                <span className="font-mono text-[0.5rem] text-muted-foreground border border-border px-1.5 py-0.5 rounded-[2px]">
                  Layer {row.layer}
                </span>
              )}
              {row.persona_mode && (
                <span className="font-mono text-[0.5rem] text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-[2px]">
                  {row.persona_mode === "demographic" ? "Demografica" : "Decision Drivers"}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div><span className="text-muted-foreground">Modello:</span> <span className="text-foreground font-medium">{MODEL_LABELS[row.model] ?? row.model}</span></div>
            <div><span className="text-muted-foreground">Run:</span> <span className="text-foreground">#{row.run_number}</span></div>
            {row.executed_at && (
              <div><span className="text-muted-foreground">Eseguito:</span> <span className="text-foreground">{new Date(row.executed_at).toLocaleString("it-IT")}</span></div>
            )}
            <div>
              <span className="text-muted-foreground">Brand citato:</span>{" "}
              {row.brand_mentioned === true ? (
                <span className="text-primary font-semibold">Si</span>
              ) : (
                <span className="text-muted-foreground">No</span>
              )}
            </div>
            {row.brand_rank != null && row.brand_rank > 0 && (
              <div><span className="text-muted-foreground">Rank:</span> <span className="text-foreground font-medium">{row.brand_rank}</span></div>
            )}
            {row.sentiment_score != null && (
              <div>
                <span className="text-muted-foreground">Sentiment:</span>{" "}
                <span className={
                  row.sentiment_score > 0.1 ? "text-primary font-medium" :
                  row.sentiment_score < -0.1 ? "text-destructive font-medium" :
                  "text-foreground"
                }>
                  {row.sentiment_score > 0 ? "+" : ""}{row.sentiment_score.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Competitors */}
          {row.competitors_found && row.competitors_found.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Competitor trovati</p>
              <div className="flex flex-wrap gap-1.5">
                {row.competitors_found.map((c, i) => (
                  <span key={i} className="text-xs bg-muted border border-border rounded-[2px] px-2 py-0.5 text-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {row.sources && row.sources.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fonti consultate dall&apos;AI</p>
              <div className="flex flex-wrap gap-1.5">
                {row.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url || `https://${s.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-muted border border-border rounded-[2px] px-2 py-1 text-foreground hover:border-primary/30 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px]">{s.label || s.domain}</span>
                    <span className="font-mono text-[0.45rem] text-muted-foreground uppercase">{s.source_type}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Full response */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Risposta AI</p>
            {row.error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-[2px] px-4 py-3">
                <p className="text-sm text-destructive">{row.error}</p>
              </div>
            ) : row.raw_response ? (
              <div className="bg-muted border border-border rounded-[2px] px-4 py-3 max-h-[400px] overflow-y-auto">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{row.raw_response}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna risposta</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

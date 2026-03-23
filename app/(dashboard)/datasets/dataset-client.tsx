"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Database, ChevronDown, X, Loader2, ExternalLink } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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
  layer?: string | null;
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
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o": "GPT-4o",
  "o1-mini": "o1 Mini",
  "o3-mini": "o3 Mini",
  "o3": "o3",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
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
  const { t, locale } = useTranslation();
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
          <h1 className="font-display font-bold text-2xl text-foreground">{t("datasets.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("datasets.subtitleFull")}</p>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="dataset-filters" className="card p-4 flex flex-wrap gap-4 items-end">
        {/* Project */}
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.project")}</label>
          <div className="relative">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="input-base w-full appearance-none pr-8"
            >
              <option value="">{t("datasets.selectProject")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Run */}
        <div className="space-y-1 min-w-[220px]">
          <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.analysis")}</label>
          <div className="relative">
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              disabled={!selectedProject || loadingRuns}
              className="input-base w-full appearance-none pr-8 disabled:opacity-50"
            >
              <option value="">
                {loadingRuns ? t("common.loading") : runs.length === 0 && selectedProject ? t("datasets.noAnalysis") : t("datasets.selectAnalysis")}
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version} — {new Date(r.created_at).toLocaleDateString(locale)} ({r.status})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Model pills */}
        {models.length > 0 && (
          <div className="space-y-1">
            <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.aiModel")}</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedModel(null)}
                className={`text-[13px] px-2.5 py-1 rounded-[2px] border transition-colors ${
                  selectedModel === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("common.all")}
              </button>
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`text-[13px] px-2.5 py-1 rounded-[2px] border transition-colors ${
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
            {t("datasets.selectProjectAndAnalysis")}
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
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground min-w-[200px]">{t("datasets.query")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.type")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.family")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.model")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.run")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.brand")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.rank")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.sent")}</th>
                  <th className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground min-w-[160px]">{t("datasets.aiResponse")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const stBadge = SET_TYPE_BADGES[row.set_type] || SET_TYPE_BADGES.manual;
                  const funnelCls = FUNNEL_BADGES[row.funnel_stage] || "border-border text-muted-foreground";
                  const response = row.raw_response || "";
                  const plain = response.replace(/#{1,6}\s/g, "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").replace(/^[-*]\s/gm, "").replace(/\n+/g, " ").trim();
                  const truncated = plain.length > 120 ? plain.slice(0, 120) + "..." : plain;

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
                        <span className={`font-mono text-[0.625rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${funnelCls}`}>
                          {row.funnel_stage}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono text-[0.625rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${stBadge.cls}`}>
                          {stBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[12px] text-muted-foreground">{MODEL_LABELS[row.model] ?? row.model}</span>
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
                          <span className="text-destructive text-[13px]">{t("common.error")}</span>
                        ) : response ? (
                          <span className="text-muted-foreground text-[13px] line-clamp-2">{truncated}</span>
                        ) : (
                          <span className="text-muted-foreground text-[13px]">—</span>
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
          <p className="text-muted-foreground text-sm">{t("datasets.noPromptForFilter")}</p>
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
  const { t, locale } = useTranslation();
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
              <span className={`font-mono text-[0.625rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${funnelCls}`}>
                {row.funnel_stage}
              </span>
              <span className={`font-mono text-[0.625rem] uppercase tracking-wide px-1.5 py-0.5 rounded-[2px] border ${stBadge.cls}`}>
                {stBadge.label}
              </span>
              {row.persona_mode && (
                <span className="font-mono text-[0.625rem] text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-[2px]">
                  {row.persona_mode === "demographic" ? t("datasets.demographic") : "Decision Drivers"}
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
            <div><span className="text-muted-foreground">{t("datasets.modelLabel")}</span> <span className="text-foreground font-medium">{MODEL_LABELS[row.model] ?? row.model}</span></div>
            <div><span className="text-muted-foreground">{t("datasets.runLabel")}</span> <span className="text-foreground">#{row.run_number}</span></div>
            {row.executed_at && (
              <div><span className="text-muted-foreground">{t("datasets.executedAt")}</span> <span className="text-foreground">{new Date(row.executed_at).toLocaleString(locale)}</span></div>
            )}
            <div>
              <span className="text-muted-foreground">{t("datasets.brandCited")}</span>{" "}
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
              <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.competitorsFound")}</p>
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
              <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.sourcesConsulted")}</p>
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
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{t("datasets.aiResponse")}</p>
            {row.error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-[2px] px-4 py-3">
                <p className="text-sm text-destructive">{row.error}</p>
              </div>
            ) : row.raw_response ? (
              <div className="bg-muted border border-border rounded-[2px] px-4 py-3 max-h-[400px] overflow-y-auto prose-ai">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-sm text-foreground leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                    h1: ({ children }) => <h1 className="text-base font-semibold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[15px] font-semibold text-foreground mb-2 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li className="text-sm text-foreground leading-relaxed">{children}</li>,
                    code: ({ children }) => <code className="font-mono text-[13px] bg-surface-2 px-1 py-0.5 rounded-[2px]">{children}</code>,
                    table: ({ children }) => <table className="w-full text-sm border-collapse border border-border rounded-[2px] my-3">{children}</table>,
                    thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
                    th: ({ children }) => <th className="text-left text-xs font-semibold text-foreground px-3 py-2 border-r border-border last:border-r-0">{children}</th>,
                    td: ({ children }) => <td className="text-sm text-foreground px-3 py-2 border-r border-border last:border-r-0">{children}</td>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-sm text-muted-foreground italic">{children}</blockquote>,
                  }}
                >
                  {row.raw_response}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("datasets.noResponse")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

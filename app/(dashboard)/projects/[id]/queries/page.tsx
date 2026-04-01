"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, MessageSquare, Sparkles, AlertTriangle, ToggleLeft, ToggleRight, CheckSquare, Square, Power, PowerOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/context";

interface Query {
  id: string;
  text: string;
  funnel_stage: "tofu" | "mofu" | "bofu";
  set_type?: string;
  is_active?: boolean;
  created_at: string;
}

const SET_TYPE_COLORS: Record<string, string> = {
  generale: "border-muted-foreground/30 text-muted-foreground bg-muted-foreground/5",
  verticale: "border-blue-500/30 text-blue-400 bg-blue-500/5",
  persona: "border-purple-500/30 text-purple-400 bg-purple-500/5",
  manual: "border-border text-muted-foreground",
};

const SET_TYPE_LABELS: Record<string, string> = {
  generale: "GEN",
  verticale: "VERT",
  persona: "PERS",
  manual: "MAN",
};

type FilterSetType = "all" | "generale" | "verticale" | "persona" | "manual";
type FilterFunnel = "all" | "tofu" | "mofu";

export default function QueriesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { t } = useTranslation();

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [targetBrand, setTargetBrand] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [tofuText, setTofuText] = useState("");
  const [mofuText, setMofuText] = useState("");

  // Filters
  const [filterSetType, setFilterSetType] = useState<FilterSetType>("all");
  const [filterFunnel, setFilterFunnel] = useState<FilterFunnel>("all");

  async function fetchQueries() {
    const res = await fetch(`/api/queries?project_id=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setQueries(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchQueries();
    createClient()
      .from("projects")
      .select("target_brand")
      .eq("id", projectId)
      .single()
      .then(({ data }: { data: any }) => { if (data?.target_brand) setTargetBrand(data.target_brand); });
  }, []);

  const containsBrand = useCallback(
    (text: string) => {
      if (!targetBrand) return false;
      return text.toLowerCase().includes(targetBrand.toLowerCase());
    },
    [targetBrand],
  );

  async function addQuery(text: string, stage: "tofu" | "mofu") {
    if (!text.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, text: text.trim(), funnel_stage: stage }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.error"));
      }
      if (stage === "tofu") setTofuText("");
      else setMofuText("");
      await fetchQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteQuery(id: string) {
    // If this query is part of a selection, delete all selected
    const idsToDelete = selected.size > 0 && selected.has(id) ? Array.from(selected) : [id];
    setError("");
    try {
      const results = await Promise.all(
        idsToDelete.map((qid) => fetch(`/api/queries?id=${qid}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(`${failed.length} query non eliminate`);
      }
      const idSet = new Set(idsToDelete);
      setQueries((prev) => prev.filter((q) => !idSet.has(q.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function toggleQuery(id: string, currentActive: boolean) {
    // If this query is part of a selection, toggle all selected
    const idsToToggle = selected.size > 0 && selected.has(id) ? Array.from(selected) : [id];
    const newActive = !currentActive;
    setError("");
    try {
      await Promise.all(
        idsToToggle.map((qid) =>
          fetch("/api/queries", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: qid, is_active: newActive }),
          })
        )
      );
      const idSet = new Set(idsToToggle);
      setQueries((prev) => prev.map((q) => idSet.has(q.id) ? { ...q, is_active: newActive } : q));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filteredQueries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredQueries.map((q) => q.id)));
    }
  }

  async function bulkToggle(activate: boolean) {
    setBulkLoading(true);
    setError("");
    const ids = Array.from(selected);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/queries", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, is_active: activate }),
          })
        )
      );
      const idSet = new Set(ids);
      setQueries((prev) => prev.map((q) => idSet.has(q.id) ? { ...q, is_active: activate } : q));
      setSelected(new Set());
    } catch { setError(t("common.error")); }
    finally { setBulkLoading(false); }
  }

  async function bulkDelete() {
    setBulkLoading(true);
    setError("");
    const ids = Array.from(selected);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/queries?id=${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) console.error(`[bulkDelete] ${failed.length}/${ids.length} failed`);
      const idSet = new Set(ids);
      setQueries((prev) => prev.filter((q) => !idSet.has(q.id)));
      setSelected(new Set());
      setConfirmBulkDelete(false);
    } catch { setError(t("common.error")); }
    finally { setBulkLoading(false); }
  }

  const activeCount = queries.filter((q) => q.is_active !== false).length;

  // Check if any queries have generation metadata
  const hasGeneratedQueries = queries.some((q) => q.set_type && q.set_type !== "manual");

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      const st = q.set_type || "manual";
      if (filterSetType !== "all" && st !== filterSetType) return false;
      if (filterFunnel !== "all" && q.funnel_stage !== filterFunnel) return false;
      return true;
    });
  }, [queries, filterSetType, filterFunnel]);

  const tofuQueries = filteredQueries.filter((q) => q.funnel_stage === "tofu");
  const mofuQueries = filteredQueries.filter((q) => q.funnel_stage === "mofu");

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("nav.backToProject")}
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">{t("queries.manageTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount}/{queries.length} query {t("queries.active") || "active"} &middot; {t("queries.addOrGenerate")}
            </p>
          </div>
          <a
            href={`/projects/${projectId}/queries/generate`}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t("settings.generatePromptAI")}
          </a>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Filter pills */}
      {hasGeneratedQueries && (
        <div className="flex flex-wrap gap-4">
          {/* Set type filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">{t("queries.filterType")}</span>
            {(["all", "generale", "verticale", "persona", "manual"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterSetType(v)}
                className={`text-[13px] px-2 py-1 rounded-[2px] border transition-colors ${
                  filterSetType === v
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "all" ? t("common.all") : v === "generale" ? t("queries.filterGeneral") : v === "verticale" ? t("queries.filterVertical") : v === "persona" ? t("queries.filterPersonas") : t("queries.filterManual")}
              </button>
            ))}
          </div>
          {/* Funnel filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">{t("generateQueries.funnelFilter")}</span>
            {(["all", "tofu", "mofu"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterFunnel(v)}
                className={`text-[13px] px-2 py-1 rounded-[2px] border transition-colors ${
                  filterFunnel === v
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "all" ? t("common.all") : v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-[2px] border border-primary/30 bg-primary/5 animate-fade-in">
          <span className="text-sm font-medium text-foreground">{selected.size} {selected.size === 1 ? "query selezionata" : "query selezionate"}</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => bulkToggle(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Power className="w-3 h-3" /> Attiva
            </button>
            <button
              onClick={() => bulkToggle(false)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <PowerOff className="w-3 h-3" /> Disattiva
            </button>
            {confirmBulkDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={bulkDelete}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-[2px] bg-destructive text-white hover:bg-destructive/80 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Conferma
                </button>
                <button onClick={() => setConfirmBulkDelete(false)} className="text-xs text-muted-foreground px-2 py-1.5 hover:text-foreground transition-colors">Annulla</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Elimina
              </button>
            )}
            <button onClick={() => { setSelected(new Set()); setConfirmBulkDelete(false); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
              Deseleziona
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">TOFU</h2>
            <span className="badge badge-muted text-[12px]">{tofuQueries.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("queries.tofuDesc")}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tofuText}
              onChange={(e) => setTofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(tofuText, "tofu"))}
              placeholder={t("queries.tofuPlaceholder")}
              className="input-base flex-1"
            />
            <button
              onClick={() => addQuery(tofuText, "tofu")}
              disabled={submitting || !tofuText.trim()}
              className="bg-primary text-primary-foreground p-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {containsBrand(tofuText) && <BrandWarning brand={targetBrand} />}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("queries.noQueryTofu")}</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q) => (
                <QueryItem key={q.id} query={q} onDelete={deleteQuery} onToggle={toggleQuery} selected={selected.has(q.id)} onSelect={toggleSelect} />
              ))}
            </ul>
          )}
        </div>

        {/* MOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h2 className="font-display font-semibold text-foreground">MOFU</h2>
            <span className="badge badge-muted text-[12px]">{mofuQueries.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("queries.mofuDesc")}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={mofuText}
              onChange={(e) => setMofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(mofuText, "mofu"))}
              placeholder={t("generateQueries.queryPlaceholder")}
              className="input-base flex-1"
            />
            <button
              onClick={() => addQuery(mofuText, "mofu")}
              disabled={submitting || !mofuText.trim()}
              className="bg-primary text-primary-foreground p-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {containsBrand(mofuText) && <BrandWarning brand={targetBrand} />}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : mofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("queries.noQueryMofu")}</p>
          ) : (
            <ul className="space-y-2">
              {mofuQueries.map((q) => (
                <QueryItem key={q.id} query={q} onDelete={deleteQuery} onToggle={toggleQuery} selected={selected.has(q.id)} onSelect={toggleSelect} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandWarning({ brand }: { brand: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-[2px] border border-[#c4a882]/30 bg-[#c4a882]/5 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-[#c4a882] shrink-0 mt-0.5" />
      <p className="text-[13px] text-[#c4a882] leading-snug">
        <span className="font-semibold">&ldquo;{brand}&rdquo;</span> — {t("queries.brandBiasWarning")}
      </p>
    </div>
  );
}

function QueryItem({ query, onDelete, onToggle, selected, onSelect }: { query: Query; onDelete: (id: string) => void; onToggle: (id: string, active: boolean) => void; selected: boolean; onSelect: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setType = query.set_type || "manual";
  const colorCls = SET_TYPE_COLORS[setType] || SET_TYPE_COLORS.manual;
  const label = SET_TYPE_LABELS[setType] || "MAN";
  const isActive = query.is_active !== false;

  return (
    <li className={`flex items-start justify-between gap-2 rounded-[2px] px-3 py-2 border group transition-colors ${
      selected ? "bg-primary/5 border-primary/30" : isActive ? "bg-muted border-border" : "bg-muted/30 border-border/50"
    }`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button onClick={() => onSelect(query.id)} className="shrink-0 transition-colors" title="Seleziona">
          {selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          }
        </button>
        <button
          onClick={() => onToggle(query.id, isActive)}
          className="shrink-0 transition-colors"
          title={isActive ? "Disattiva" : "Attiva"}
        >
          {isActive
            ? <ToggleRight className="w-5 h-5 text-primary" />
            : <ToggleLeft className="w-5 h-5 text-muted-foreground/50" />
          }
        </button>
        <span className={`text-sm ${isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>{query.text}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {setType !== "manual" && (
          <span className={`font-mono text-[0.625rem] tracking-wide uppercase px-1 py-0.5 rounded-[2px] border ${colorCls}`}>
            {label}
          </span>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-1 animate-fade-in">
            <button
              onClick={() => { onDelete(query.id); setConfirmDelete(false); }}
              className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors px-1.5 py-0.5 rounded-[2px] border border-destructive/30 bg-destructive/10"
            >
              Elimina
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5"
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            title="Elimina query"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

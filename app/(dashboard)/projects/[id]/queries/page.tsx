"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Sparkles, AlertTriangle, ToggleLeft, ToggleRight, CheckSquare, Square, Power, PowerOff, Pencil, ChevronDown } from "lucide-react";
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

  const [manualText, setManualText] = useState("");
  const [projectSector, setProjectSector] = useState<string | null>(null);
  const [projectCountry, setProjectCountry] = useState<string | null>(null);

  // Accordion esclusivo per le 2 sezioni: solo una aperta alla volta.
  // Click sull'header: se gia' aperta si chiude, altrimenti apre quella e chiude
  // l'altra. Default: nessuna aperta.
  type OpenSection = "ai" | "manual" | null;
  const [openSection, setOpenSection] = useState<OpenSection>(null);

  // Filters (set_type only — funnel TOFU/MOFU rimosso dalla UI)
  const [filterSetType, setFilterSetType] = useState<FilterSetType>("all");

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
      .select("target_brand, sector, country")
      .eq("id", projectId)
      .single()
      .then(({ data }: { data: any }) => {
        if (data?.target_brand) setTargetBrand(data.target_brand);
        if (data?.sector) setProjectSector(data.sector);
        if (data?.country) setProjectCountry(data.country);
      });
  }, []);

  const containsBrand = useCallback(
    (text: string) => {
      if (!targetBrand) return false;
      return text.toLowerCase().includes(targetBrand.toLowerCase());
    },
    [targetBrand],
  );

  // Add manual query: nessun funnel stage selezionato (default DB = tofu),
  // l'engine non lo usa per ordinamento utente. Tutto cio' che si scrive a
  // mano viene marcato come set_type="manual" implicito (default DB).
  async function addManualQuery(text: string) {
    if (!text.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, text: text.trim(), funnel_stage: "tofu" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.error"));
      }
      setManualText("");
      await fetchQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateQueryText(id: string, text: string) {
    try {
      const res = await fetch("/api/queries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.error"));
      }
      setQueries((prev) => prev.map((q) => q.id === id ? { ...q, text } : q));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
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
        throw new Error(`${failed.length} ${t("queries.deleteFailedCount")}`);
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
      return true;
    });
  }, [queries, filterSetType]);

  // Split per origine: AI = generata da wizard (set_type non manual);
  // Manual = inserita a mano dall'utente.
  const aiQueries = filteredQueries.filter((q) => q.set_type && q.set_type !== "manual");
  const manualQueries = filteredQueries.filter((q) => !q.set_type || q.set_type === "manual");

  const generateHref = `/projects/${projectId}/queries/generate`;

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
          <div className="flex items-center gap-2">
            <a
              href={generateHref}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t("settings.generatePromptAI")}
            </a>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-[2px] border border-primary/30 bg-primary/5 animate-fade-in">
          <span className="text-sm font-medium text-foreground">{selected.size} {selected.size === 1 ? t("queries.selectedSingular") : t("queries.selectedPlural")}</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => bulkToggle(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Power className="w-3 h-3" /> {t("common.activate")}
            </button>
            <button
              onClick={() => bulkToggle(false)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <PowerOff className="w-3 h-3" /> {t("common.deactivate")}
            </button>
            {confirmBulkDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={bulkDelete}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-[2px] bg-destructive text-white hover:bg-destructive/80 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} {t("common.confirm")}
                </button>
                <button onClick={() => setConfirmBulkDelete(false)} className="text-xs text-muted-foreground px-2 py-1.5 hover:text-foreground transition-colors">{t("common.cancel")}</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> {t("common.delete")}
              </button>
            )}
            <button onClick={() => { setSelected(new Set()); setConfirmBulkDelete(false); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
              {t("common.deselect")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Query AI — accordion. Click sull'header: apre solo questa sezione
            (l'altra si chiude). Bottone + dentro l'header porta sempre al
            wizard, anche quando ci sono gia' query AI. */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === "ai" ? null : "ai")}
            className="w-full flex items-center gap-2 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
            aria-expanded={openSection === "ai"}
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("queries.aiSection")}</h2>
            <span className="badge badge-muted text-[12px]">{aiQueries.length}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${openSection === "ai" ? "rotate-180" : ""}`} />
            <a
              href={generateHref}
              onClick={(e) => e.stopPropagation()}
              className="bg-primary text-primary-foreground p-2 rounded-[2px] hover:bg-primary/85 transition-colors"
              title={t("queries.aiGenerateTooltip")}
            >
              <Plus className="w-4 h-4" />
            </a>
          </button>

          {openSection === "ai" && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : aiQueries.length === 0 ? (
                <a
                  href={generateHref}
                  className="block rounded-[2px] border border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors p-6 text-center"
                >
                  <Sparkles className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">{t("queries.emptyAiTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("queries.emptyAiSubtitle")}</p>
                </a>
              ) : (
                <ul className="space-y-2">
                  {aiQueries.map((q) => (
                    <QueryItem key={q.id} query={q} onDelete={deleteQuery} onToggle={toggleQuery} onUpdateText={updateQueryText} selected={selected.has(q.id)} onSelect={toggleSelect} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Query Manuali — accordion. Click sull'header: apre questa sezione e
            chiude l'AI. Dentro: input per aggiungere + lista editabile. */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === "manual" ? null : "manual")}
            className="w-full flex items-center gap-2 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
            aria-expanded={openSection === "manual"}
          >
            <Pencil className="w-4 h-4 text-accent" />
            <h2 className="font-display font-semibold text-foreground">{t("queries.manualSection")}</h2>
            <span className="badge badge-muted text-[12px]">{manualQueries.length}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${openSection === "manual" ? "rotate-180" : ""}`} />
          </button>

          {openSection === "manual" && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border">
              <p className="text-xs text-muted-foreground">{t("queries.manualHelp")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManualQuery(manualText))}
                  placeholder={t("queries.manualPlaceholder")}
                  className="input-base flex-1"
                />
                <button
                  onClick={() => addManualQuery(manualText)}
                  disabled={submitting || !manualText.trim()}
                  className="bg-primary text-primary-foreground p-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
              {containsBrand(manualText) && <BrandWarning brand={targetBrand} />}
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : manualQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("queries.emptyManual")}</p>
              ) : (
                <ul className="space-y-2">
                  {manualQueries.map((q) => (
                    <QueryItem key={q.id} query={q} onDelete={deleteQuery} onToggle={toggleQuery} onUpdateText={updateQueryText} selected={selected.has(q.id)} onSelect={toggleSelect} />
                  ))}
                </ul>
              )}
            </div>
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

function QueryItem({ query, onDelete, onToggle, onUpdateText, selected, onSelect }: { query: Query; onDelete: (id: string) => void; onToggle: (id: string, active: boolean) => void; onUpdateText: (id: string, text: string) => void; selected: boolean; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(query.text);
  const setType = query.set_type || "manual";
  const colorCls = SET_TYPE_COLORS[setType] || SET_TYPE_COLORS.manual;
  const label = SET_TYPE_LABELS[setType] || "MAN";
  const isActive = query.is_active !== false;

  function commitEdit() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== query.text) onUpdateText(query.id, trimmed);
    setEditing(false);
  }

  return (
    <li className={`flex items-start justify-between gap-2 rounded-[2px] px-3 py-2 border group transition-colors ${
      selected ? "bg-primary/5 border-primary/30" : isActive ? "bg-muted border-border" : "bg-muted/30 border-border/50"
    }`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button onClick={() => onSelect(query.id)} className="shrink-0 transition-colors" title={t("queries.selectTooltip")}>
          {selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          }
        </button>
        <button
          onClick={() => onToggle(query.id, isActive)}
          className="shrink-0 transition-colors"
          title={isActive ? t("common.deactivate") : t("common.activate")}
        >
          {isActive
            ? <ToggleRight className="w-5 h-5 text-primary" />
            : <ToggleLeft className="w-5 h-5 text-muted-foreground/50" />
          }
        </button>
        {editing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { setEditText(query.text); setEditing(false); }
            }}
            autoFocus
            className="input-base flex-1 text-sm py-1"
          />
        ) : (
          <span
            className={`text-sm cursor-text flex-1 ${isActive ? "text-foreground hover:text-primary" : "text-muted-foreground line-through"} transition-colors`}
            onClick={() => { setEditText(query.text); setEditing(true); }}
            title={t("queries.editTooltip")}
          >
            {query.text}
          </span>
        )}
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
              {t("common.delete")}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            title={t("queries.deleteTooltip")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

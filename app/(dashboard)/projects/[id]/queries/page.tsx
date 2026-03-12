"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, MessageSquare, Sparkles, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Query {
  id: string;
  text: string;
  funnel_stage: "tofu" | "mofu" | "bofu";
  set_type?: string;
  layer?: string;
  funnel?: string;
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
type FilterLayer = "all" | "A" | "B" | "C";

export default function QueriesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [targetBrand, setTargetBrand] = useState("");

  const [tofuText, setTofuText] = useState("");
  const [mofuText, setMofuText] = useState("");

  // Filters
  const [filterSetType, setFilterSetType] = useState<FilterSetType>("all");
  const [filterFunnel, setFilterFunnel] = useState<FilterFunnel>("all");
  const [filterLayer, setFilterLayer] = useState<FilterLayer>("all");

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
        throw new Error(data.error || "Errore");
      }
      if (stage === "tofu") setTofuText("");
      else setMofuText("");
      await fetchQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteQuery(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/queries?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      setQueries(queries.filter((q) => q.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    }
  }

  // Check if any queries have generation metadata
  const hasGeneratedQueries = queries.some((q) => q.set_type && q.set_type !== "manual");

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => {
      const st = q.set_type || "manual";
      if (filterSetType !== "all" && st !== filterSetType) return false;
      if (filterFunnel !== "all" && q.funnel_stage !== filterFunnel) return false;
      if (filterLayer !== "all" && q.layer !== filterLayer) return false;
      return true;
    });
  }, [queries, filterSetType, filterFunnel, filterLayer]);

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
          Torna al progetto
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Gestione Query</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {queries.length} query &middot; Aggiungi o genera domande per i modelli AI
            </p>
          </div>
          <a
            href={`/projects/${projectId}/queries/generate`}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Genera Prompt con AI
            <span className="font-mono text-[0.69rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1.5 py-0.5 rounded-[2px] bg-[#c4a882]/10">PRO</span>
          </a>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Filter pills */}
      {hasGeneratedQueries && (
        <div className="flex flex-wrap gap-4">
          {/* Set type filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Tipo</span>
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
                {v === "all" ? "Tutti" : v === "generale" ? "Generali" : v === "verticale" ? "Verticali" : v === "persona" ? "Personas" : "Manuali"}
              </button>
            ))}
          </div>
          {/* Funnel filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Funnel</span>
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
                {v === "all" ? "Tutti" : v.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Layer filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Layer</span>
            {(["all", "A", "B", "C"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterLayer(v)}
                className={`text-[13px] px-2 py-1 rounded-[2px] border transition-colors ${
                  filterLayer === v
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "all" ? "Tutti" : v}
              </button>
            ))}
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
          <p className="text-xs text-muted-foreground">Domande top-of-funnel, generiche e informative</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tofuText}
              onChange={(e) => setTofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(tofuText, "tofu"))}
              placeholder="Es. Quali sono le tendenze nel mio settore?"
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
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna query TOFU</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q) => (
                <QueryItem key={q.id} query={q} onDelete={deleteQuery} />
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
          <p className="text-xs text-muted-foreground">Domande middle-of-funnel, comparative e valutative</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={mofuText}
              onChange={(e) => setMofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(mofuText, "mofu"))}
              placeholder="Es. Qual è il miglior prodotto per..."
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
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna query MOFU</p>
          ) : (
            <ul className="space-y-2">
              {mofuQueries.map((q) => (
                <QueryItem key={q.id} query={q} onDelete={deleteQuery} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandWarning({ brand }: { brand: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-[2px] border border-[#c4a882]/30 bg-[#c4a882]/5 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-[#c4a882] shrink-0 mt-0.5" />
      <p className="text-[13px] text-[#c4a882] leading-snug">
        La query contiene <span className="font-semibold">&ldquo;{brand}&rdquo;</span>. Inserire il nome del brand nelle query potrebbe creare bias nei risultati dell&apos;analisi.
      </p>
    </div>
  );
}

function QueryItem({ query, onDelete }: { query: Query; onDelete: (id: string) => void }) {
  const setType = query.set_type || "manual";
  const colorCls = SET_TYPE_COLORS[setType] || SET_TYPE_COLORS.manual;
  const label = SET_TYPE_LABELS[setType] || "MAN";

  return (
    <li className="flex items-start justify-between gap-2 bg-muted rounded-[2px] px-3 py-2 border border-border group">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{query.text}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {setType !== "manual" && (
          <>
            <span className={`font-mono text-[0.625rem] tracking-wide uppercase px-1 py-0.5 rounded-[2px] border ${colorCls}`}>
              {label}
            </span>
            {query.layer && (
              <span className="font-mono text-[0.625rem] tracking-wide text-muted-foreground border border-border px-1 py-0.5 rounded-[2px]">
                {query.layer}
              </span>
            )}
          </>
        )}
        <button
          onClick={() => onDelete(query.id)}
          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

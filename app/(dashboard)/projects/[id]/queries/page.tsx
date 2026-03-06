"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, MessageSquare } from "lucide-react";

interface Query {
  id: string;
  text: string;
  funnel_stage: "tofu" | "mofu" | "bofu";
  created_at: string;
}

export default function QueriesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [tofuText, setTofuText] = useState("");
  const [mofuText, setMofuText] = useState("");

  async function fetchQueries() {
    const res = await fetch(`/api/queries?project_id=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setQueries(data);
    }
    setLoading(false);
  }

  useEffect(() => { fetchQueries(); }, []);

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

  const tofuQueries = queries.filter((q) => q.funnel_stage === "tofu");
  const mofuQueries = queries.filter((q) => q.funnel_stage === "mofu");

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
        <h1 className="font-display font-bold text-2xl text-foreground">Gestione Query</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggiungi le domande da sottoporre ai modelli AI
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">TOFU</h2>
            <span className="badge badge-muted text-[10px]">{tofuQueries.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">Domande top-of-funnel, generiche e informative</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tofuText}
              onChange={(e) => setTofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(tofuText, "tofu"))}
              placeholder="Es. Cos'è il marketing AI?"
              className="input-base flex-1"
            />
            <button
              onClick={() => addQuery(tofuText, "tofu")}
              disabled={submitting || !tofuText.trim()}
              className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna query TOFU</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-2 bg-muted rounded-lg px-3 py-2 border border-border group">
                  <span className="text-sm text-foreground">{q.text}</span>
                  <button
                    onClick={() => deleteQuery(q.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* MOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h2 className="font-display font-semibold text-foreground">MOFU</h2>
            <span className="badge badge-muted text-[10px]">{mofuQueries.length}</span>
          </div>
          <p className="text-xs text-muted-foreground">Domande middle-of-funnel, comparative e valutative</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={mofuText}
              onChange={(e) => setMofuText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery(mofuText, "mofu"))}
              placeholder="Es. Quali sono i migliori tool di..."
              className="input-base flex-1"
            />
            <button
              onClick={() => addQuery(mofuText, "mofu")}
              disabled={submitting || !mofuText.trim()}
              className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : mofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna query MOFU</p>
          ) : (
            <ul className="space-y-2">
              {mofuQueries.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-2 bg-muted rounded-lg px-3 py-2 border border-border group">
                  <span className="text-sm text-foreground">{q.text}</span>
                  <button
                    onClick={() => deleteQuery(q.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

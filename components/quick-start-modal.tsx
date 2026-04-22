"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Sparkles, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

type Query = { text: string; funnel_stage: "tofu" | "mofu" };

export function QuickStartModal({
  open,
  projectId,
  onClose,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queries, setQueries] = useState<Query[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [fallback, setFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-preview on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setFallback(false);

    fetch(`/api/projects/${projectId}/quick-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview" }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 429) throw new Error(t("quickStartModal.limitReached"));
          if (res.status === 403) throw new Error(t("quickStartModal.demoLocked"));
          throw new Error(data?.error ?? t("quickStartModal.error"));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setQueries(Array.isArray(data.queries) ? data.queries : []);
        setCompetitors(Array.isArray(data.competitors) ? data.competitors : []);
        setFallback(Boolean(data.fallback));
      })
      .catch((err: Error) => {
        if (!cancelled) setErrorMsg(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, projectId, t]);

  function updateQueryText(i: number, text: string) {
    setQueries((prev) => prev.map((q, idx) => (idx === i ? { ...q, text } : q)));
  }
  function toggleStage(i: number) {
    setQueries((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, funnel_stage: q.funnel_stage === "tofu" ? "mofu" : "tofu" } : q)),
    );
  }
  function removeQuery(i: number) {
    setQueries((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addQuery() {
    setQueries((prev) => [...prev, { text: "", funnel_stage: "tofu" }]);
  }

  function removeCompetitor(i: number) {
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addCompetitor() {
    const v = newCompetitor.trim();
    if (!v) return;
    if (competitors.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setNewCompetitor("");
      return;
    }
    setCompetitors((prev) => [...prev, v].slice(0, 10));
    setNewCompetitor("");
  }

  async function handleSave() {
    const valid = queries.filter((q) => q.text.trim().length >= 5);
    if (valid.length === 0) {
      setErrorMsg(t("quickStartModal.noValidQueries"));
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/quick-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          queries: valid.map((q) => ({ text: q.text.trim(), funnel_stage: q.funnel_stage })),
          competitors: competitors.slice(0, 10),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t("quickStartModal.error"));

      const n = data?.inserted ?? 0;
      toast.success(t("quickStartModal.success").replace("{n}", String(n)));
      onClose();
      router.refresh();
      // Give the router a tick to re-render, then open the launcher.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-analysis-modal"));
      }, 250);
    } catch (err: any) {
      setErrorMsg(err?.message ?? t("quickStartModal.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const validCount = queries.filter((q) => q.text.trim().length >= 5).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col border border-primary/40 bg-background">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">
              {t("projectDetail.quickStartTitle")}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-[2px] transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">{t("quickStartModal.loading")}</p>
            </div>
          )}

          {!loading && errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-[2px] border border-red/40 bg-red/5">
              <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{errorMsg}</p>
            </div>
          )}

          {!loading && fallback && (
            <div className="flex items-start gap-2 p-3 rounded-[2px] border border-yellow/40 bg-yellow/5">
              <AlertCircle className="w-4 h-4 text-yellow shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{t("quickStartModal.fallback")}</p>
            </div>
          )}

          {!loading && (
            <>
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("quickStartModal.queriesTitle")}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("quickStartModal.queriesSubtitle")}</p>
                </div>
                <div className="space-y-2">
                  {queries.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStage(i)}
                        className={`shrink-0 mt-1 px-2 py-1 text-[10px] font-bold uppercase rounded-[2px] border transition-colors ${
                          q.funnel_stage === "tofu"
                            ? "border-blue/40 text-blue bg-blue/5"
                            : "border-primary/40 text-primary bg-primary/5"
                        }`}
                        title={t("quickStartModal.toggleStage")}
                      >
                        {q.funnel_stage.toUpperCase()}
                      </button>
                      <textarea
                        value={q.text}
                        onChange={(e) => updateQueryText(i, e.target.value)}
                        className="flex-1 bg-surface border border-border text-foreground text-sm px-3 py-2 rounded-[2px] resize-none focus:border-primary/40 focus:outline-none"
                        rows={2}
                        maxLength={500}
                      />
                      <button
                        type="button"
                        onClick={() => removeQuery(i)}
                        className="shrink-0 mt-1 p-1.5 text-muted-foreground hover:text-red hover:bg-red/10 rounded-[2px] transition-colors"
                        title={t("quickStartModal.removeQuery")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addQuery}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("quickStartModal.addQuery")}
                </button>
              </section>

              <section className="space-y-3 pt-2 border-t border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("quickStartModal.competitorsTitle")}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("quickStartModal.competitorsSubtitle")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {competitors.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-surface border border-border rounded-[2px]"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(i)}
                        className="text-muted-foreground hover:text-red"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {competitors.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">{t("quickStartModal.noCompetitors")}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={newCompetitor}
                    onChange={(e) => setNewCompetitor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetitor(); } }}
                    placeholder={t("quickStartModal.competitorPlaceholder")}
                    className="flex-1 bg-surface border border-border text-foreground text-sm px-3 py-1.5 rounded-[2px] focus:border-primary/40 focus:outline-none"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={addCompetitor}
                    className="px-3 py-1.5 text-xs font-semibold bg-surface border border-border text-foreground rounded-[2px] hover:border-primary/30"
                  >
                    {t("quickStartModal.addCompetitor")}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {t("quickStartModal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving || validCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t("quickStartModal.confirm")} ({validCount})
          </button>
        </div>
      </div>
    </div>
  );
}

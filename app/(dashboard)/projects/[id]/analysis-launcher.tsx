"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Loader2, Cpu, Globe, AlertTriangle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

const RUN_OPTIONS = [
  { value: 1, label: "1 run", desc: "Veloce" },
  { value: 2, label: "2 run", desc: "Bilanciato" },
  { value: 3, label: "3 run", desc: "Preciso" },
] as const;

export function AnalysisLauncher({
  projectId,
  hasQueries,
  queryCount,
  segmentCount,
  modelsConfig,
}: {
  projectId: string;
  hasQueries: boolean;
  queryCount: number;
  segmentCount: number;
  modelsConfig: string[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Allow external components to open the modal via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-analysis-modal", handler);
    return () => window.removeEventListener("open-analysis-modal", handler);
  }, []);
  const [runCount, setRunCount] = useState(1);
  const [browsing, setBrowsing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Profile data for quota check
  const [isPro, setIsPro] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        setIsPro(p?.plan === "pro" || p?.plan === "agency");
        setQueriesUsed(p?.queries_used_this_month ?? 0);
      })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, []);

  const monthlyLimit = isPro ? 500 : 100;

  const totalPrompts = useMemo(() => {
    return modelsConfig.length * queryCount * Math.max(segmentCount, 1) * runCount;
  }, [modelsConfig.length, queryCount, segmentCount, runCount]);

  // Query cost = queries × models × runs
  const queryCost = useMemo(() => {
    return queryCount * modelsConfig.length * runCount;
  }, [queryCount, modelsConfig.length, runCount]);

  const remaining = monthlyLimit - queriesUsed;
  const wouldExceed = queryCost > remaining;

  async function startAnalysis() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, run_count: runCount, browsing }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("analysisLauncher.startError"));
      }

      const data = await res.json();
      const runId = data.run_id ?? data.runId;
      setOpen(false);
      if (runId) {
        router.push(`/projects/${projectId}/runs/${runId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  const canStart = hasQueries;

  return (
    <>
      <button
        data-tour="launch-analysis-btn"
        onClick={() => canStart ? setOpen(true) : setError(t("analysisLauncher.configureQueries"))}
        className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
      >
        <Play className="w-4 h-4" />
        {t("analysisLauncher.launchAnalysis")}
      </button>

      {!canStart && error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
          <div className="relative card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-5 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg text-foreground">{t("analysisLauncher.startAnalysis")}</h2>
              </div>
              <button onClick={() => !loading && setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Models info (readonly pills) */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("analysisLauncher.projectAIModels")}</p>
              <div className="flex flex-wrap gap-2">
                {modelsConfig.map((modelId) => (
                  <span
                    key={modelId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/30 bg-primary/5 text-foreground"
                  >
                    <Cpu className="w-3 h-3 text-primary" />
                    {modelId}
                  </span>
                ))}
              </div>
              <p className="text-[13px] text-cream-dim">{t("analysisLauncher.modelsFixedAtCreation")}</p>
            </div>

            {/* Run count selector */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                {t("analysisLauncher.runCount")}
                <InfoTooltip text={t("analysisLauncher.preciseWithConsistency")} />
              </p>
              <div className="grid grid-cols-3 gap-2">
                {RUN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRunCount(opt.value)}
                    disabled={loading}
                    className={`px-3 py-2.5 rounded-sm transition-all text-center ${
                      runCount === opt.value
                        ? "border-2 border-sage bg-[rgba(126,184,154,0.12)]"
                        : "border border-border hover:border-border/80"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-[13px] text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Browsing toggle */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                {t("analysisLauncher.webBrowsing")}
                <InfoTooltip text="Abilita la navigazione web per i modelli AI. Produce risposte più aggiornate e più fonti, ma è più lento." />
              </p>
              <button
                onClick={() => setBrowsing(!browsing)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm border transition-all text-left ${
                  browsing
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div className={`relative w-9 h-5 rounded-full transition-colors ${browsing ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${browsing ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <p className="text-sm font-medium text-foreground">{t("analysisLauncher.browsingActive")}</p>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    I modelli cercano informazioni aggiornate sul web (piu lento, piu fonti)
                  </p>
                </div>
              </button>
            </div>

            {/* Query cost breakdown */}
            <div className="space-y-2 rounded-[2px] border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {t("analysisLauncher.thisAnalysisWillUse")} <span className="text-foreground font-bold">{queryCost}</span> query sul tuo piano
              </p>
              <p className="text-xs text-muted-foreground">
                ({queryCount} query &times; {modelsConfig.length} modell{modelsConfig.length === 1 ? "o" : "i"} &times; {runCount} run)
              </p>
              {profileLoaded && (
                <p className="text-xs text-muted-foreground">
                  Hai <span className="text-foreground font-medium">{remaining}</span> {t("analysisLauncher.queriesRemaining")} ({queriesUsed}/{monthlyLimit} utilizzate)
                </p>
              )}
            </div>

            {/* Exceed warning */}
            {profileLoaded && wouldExceed && (
              <div className="flex items-start gap-2.5 rounded-[2px] border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  {t("analysisLauncher.notEnoughQueries")}
                </p>
              </div>
            )}

            {/* Footer info */}
            <p className="text-sm text-muted-foreground text-center">
              <span className="text-foreground font-medium">{modelsConfig.length}</span> modell{modelsConfig.length === 1 ? "o" : "i"} &middot;{" "}
              <span className="text-foreground font-medium">{totalPrompts}</span> {t("analysisLauncher.totalPrompts")}
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => !loading && setOpen(false)}
                disabled={loading}
                className="flex-1 text-sm font-semibold py-2.5 rounded-sm border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={startAnalysis}
                disabled={loading || (profileLoaded && wouldExceed)}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-sm hover:bg-primary/85 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("analysisLauncher.analysisInProgress")}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t("analysisLauncher.startAnalysis")}
                  </>
                )}
              </button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground text-center">
                {t("analysisLauncher.analysisTime")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

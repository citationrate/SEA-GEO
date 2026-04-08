"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, X, Loader2, Cpu, Globe, AlertTriangle, Lock, Settings2, Wallet } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";
import { useUsage } from "@/lib/hooks/useUsage";

const RUN_OPTIONS = [
  { value: 1, label: "1 run", descKey: "analysisLauncher.runOptFast" },
  { value: 2, label: "2 run", descKey: "analysisLauncher.runOptBalanced" },
  { value: 3, label: "3 run", descKey: "analysisLauncher.runOptPrecise" },
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
  const [querySource, setQuerySource] = useState<"plan" | "wallet">("plan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Usage & plan limits
  const usage = useUsage();
  const profileLoaded = !usage.loading;
  const isDemo = usage.isDemo;
  const isBase = usage.planId === "base";

  // Demo plan: no browsing allowed
  const effectiveBrowsing = isDemo ? false : browsing;

  const totalPrompts = useMemo(() => {
    return modelsConfig.length * queryCount * Math.max(segmentCount, 1) * runCount;
  }, [modelsConfig.length, queryCount, segmentCount, runCount]);

  // Wallet availability
  const hasWallet = usage.wallet.browsingQueries > 0 || usage.wallet.noBrowsingQueries > 0;

  // Check against the appropriate counter based on query source
  const browsingRemaining = usage.browsingPromptsRemaining;
  const noBrowsingRemaining = usage.noBrowsingPromptsRemaining;

  const walletBrowsingAvail = usage.wallet.browsingQueries;
  const walletNoBrowsingAvail = usage.wallet.noBrowsingQueries;

  const wouldExceed = querySource === "wallet"
    ? (effectiveBrowsing ? totalPrompts > walletBrowsingAvail : totalPrompts > walletNoBrowsingAvail)
    : (effectiveBrowsing ? totalPrompts > browsingRemaining : totalPrompts > noBrowsingRemaining);
  const modelsExceed = modelsConfig.length > usage.maxModelsPerProject;

  // Auto-disable browsing when browsing counter exhausted
  useEffect(() => {
    if (profileLoaded && browsingRemaining <= 0 && !isDemo) {
      setBrowsing(false);
    }
  }, [profileLoaded, browsingRemaining, isDemo]);

  // Full-screen upgrade modal for demo users who exhausted prompts
  const demoExhausted = isDemo && noBrowsingRemaining <= 0 && profileLoaded;

  async function startAnalysis() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, run_count: runCount, browsing: effectiveBrowsing, query_source: (isBase && effectiveBrowsing) ? "plan" : querySource }),
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

  // Next month name for renewal message
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString("it-IT", { day: "numeric", month: "long" });

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

      {/* Demo exhausted — full-screen upgrade modal */}
      {demoExhausted && open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
          <div className="relative card p-8 w-full max-w-md text-center space-y-5 shadow-xl">
            <Lock className="w-12 h-12 text-[#c4a882] mx-auto" />
            <h2 className="font-display font-bold text-xl text-foreground">Demo esaurita</h2>
            <p className="text-muted-foreground text-sm">
              Hai utilizzato tutti i 40 prompt della demo gratuita. Passa al piano Base o Pro per continuare le analisi.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 text-sm font-semibold py-2.5 rounded-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                Chiudi
              </button>
              <a href="/piano" className="flex-1 flex items-center justify-center gap-2 bg-[#c4a882] text-background font-semibold text-sm py-2.5 rounded-sm hover:bg-[#c4a882]/85 transition-colors">
                Scegli un piano
              </a>
            </div>
          </div>
        </div>
      )}

      {open && !demoExhausted && (
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
                    <p className="text-[13px] text-muted-foreground">{t(opt.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Browsing toggle — hidden for demo */}
            {!isDemo && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  {t("analysisLauncher.webBrowsing")}
                  <InfoTooltip text={t("analysisLauncher.browsingTooltip")} />
                </p>
                <button
                  onClick={() => browsingRemaining > 0 && setBrowsing(!browsing)}
                  disabled={loading || browsingRemaining <= 0}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm border transition-all text-left ${
                    browsing && browsingRemaining > 0
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-border/80"
                  } ${browsingRemaining <= 0 ? "opacity-60" : ""}`}
                >
                  <div className={`relative w-11 h-6 rounded-full border transition-colors ${
                    browsing && browsingRemaining > 0
                      ? "bg-primary border-primary"
                      : "bg-muted border-border"
                  }`}>
                    <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full shadow-sm transition-all duration-200 ${
                      browsing && browsingRemaining > 0
                        ? "translate-x-[22px] bg-white"
                        : "translate-x-[1px] bg-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      <p className="text-sm font-medium text-foreground">{t("analysisLauncher.browsingActive")}</p>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {browsingRemaining <= 0
                        ? `Browsing esaurito — riprende il ${nextMonth}`
                        : t("analysisLauncher.browsingDescShort")}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Query source selector — only shown if wallet has credits */}
            {!isDemo && !(isBase && effectiveBrowsing) && hasWallet && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> {t("piano.querySource")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setQuerySource("plan")}
                    disabled={loading}
                    className={`px-3 py-2.5 rounded-sm transition-all text-left ${
                      querySource === "plan"
                        ? "border-2 border-sage bg-[rgba(126,184,154,0.12)]"
                        : "border border-border hover:border-border/80"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{t("piano.querySourcePlan")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {effectiveBrowsing ? `${browsingRemaining} browsing` : `${noBrowsingRemaining} no-browsing`} {t("piano.remaining")}
                    </p>
                  </button>
                  <button
                    onClick={() => setQuerySource("wallet")}
                    disabled={loading}
                    className={`px-3 py-2.5 rounded-sm transition-all text-left ${
                      querySource === "wallet"
                        ? "border-2 border-[#c4a882] bg-[rgba(196,168,130,0.12)]"
                        : "border border-border hover:border-border/80"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#c4a882]" /> {t("piano.querySourceWallet")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {effectiveBrowsing ? `${walletBrowsingAvail} browsing` : `${walletNoBrowsingAvail} no-browsing`} {t("piano.available")}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Usage counters with visual bars */}
            <div className="space-y-3 rounded-[2px] border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {t("analysisLauncher.thisAnalysisWillUse")} <span className="text-foreground font-bold">{totalPrompts}</span> {t("analysisLauncher.promptsOnPlan")}
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground flex-1">
                  {queryCount} query &times; {modelsConfig.length} {modelsConfig.length === 1 ? t("analysisLauncher.modelSingular") : t("analysisLauncher.modelPlural")} &times; {Math.max(segmentCount, 1)} {segmentCount === 1 ? t("analysisLauncher.segmentSingular") : t("analysisLauncher.segmentPlural")} &times; {runCount} run = {totalPrompts} prompt
                </p>
                <a
                  href={`/projects/${projectId}/queries`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/70 border border-primary/25 rounded-[2px] px-2 py-1 transition-colors shrink-0"
                >
                  <Settings2 className="w-3 h-3" />
                  Manage queries
                </a>
              </div>

              {profileLoaded && !isDemo && (
                <div className="space-y-2.5 pt-2 border-t border-border mt-2">
                  {/* Browsing prompts bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> Browsing
                      </span>
                      <span className="text-foreground font-medium">
                        {usage.browsingPromptsUsed}/{usage.browsingPromptsLimit}
                        {usage.extraBrowsingPrompts > 0 && <span className="text-primary ml-1">(+{usage.extraBrowsingPrompts})</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${usage.browsingPromptsLimit > 0 ? Math.min((usage.browsingPromptsUsed / usage.browsingPromptsLimit) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  {/* No-browsing prompts bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Cpu className="w-3 h-3" /> No browsing
                      </span>
                      <span className="text-foreground font-medium">
                        {usage.noBrowsingPromptsUsed}/{usage.noBrowsingPromptsLimit}
                        {usage.extraNoBrowsingPrompts > 0 && <span className="text-primary ml-1">(+{usage.extraNoBrowsingPrompts})</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${usage.noBrowsingPromptsLimit > 0 ? Math.min((usage.noBrowsingPromptsUsed / usage.noBrowsingPromptsLimit) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {profileLoaded && isDemo && (
                <div className="space-y-1 pt-2 border-t border-border mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Prompt</span>
                    <span className="text-foreground font-medium">{usage.noBrowsingPromptsUsed} / {usage.noBrowsingPromptsLimit}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${usage.noBrowsingPromptsLimit > 0 ? Math.min((usage.noBrowsingPromptsUsed / usage.noBrowsingPromptsLimit) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Exceed warnings — hard block for ALL plans */}
            {profileLoaded && wouldExceed && (
              <div className="flex items-start gap-2.5 rounded-[2px] border border-destructive/30 bg-destructive/10 px-4 py-3">
                <Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive space-y-1.5">
                  <p className="font-semibold">Lancio bloccato — prompt insufficienti</p>
                  <p>
                    {effectiveBrowsing
                      ? `Questa analisi richiede ${totalPrompts} prompt con browsing ma te ne restano solo ${browsingRemaining}. Disattiva il browsing oppure riduci le query.`
                      : `Questa analisi richiede ${totalPrompts} prompt ma te ne restano solo ${noBrowsingRemaining}. Riduci le query o passa a un piano superiore.`}
                  </p>
                  {!usage.isPro && (
                    <a href="/piano" className="inline-flex items-center gap-1 text-[#c4a882] hover:underline font-medium">
                      {isDemo ? "Passa a Base o Pro →" : "Passa a Pro →"}
                    </a>
                  )}
                </div>
              </div>
            )}
            {profileLoaded && modelsExceed && (
              <div className="flex items-start gap-2.5 rounded-[2px] border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  {t("analysisLauncher.maxModelsExceed").replace("{n}", String(usage.maxModelsPerProject))}
                </p>
              </div>
            )}

            {/* Footer info */}
            <p className="text-sm text-muted-foreground text-center">
              <span className="text-foreground font-medium">{modelsConfig.length}</span> {modelsConfig.length === 1 ? t("analysisLauncher.modelSingular") : t("analysisLauncher.modelPlural")} &middot;{" "}
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
                disabled={loading || (profileLoaded && (wouldExceed || modelsExceed))}
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

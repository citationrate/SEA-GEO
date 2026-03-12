import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Archive } from "lucide-react";
import { RunAVIRing } from "./run-avi-ring";
import { ExportButtons } from "./export-buttons";
import { RunAutoRefresh } from "./run-auto-refresh";
import { RunMetrics } from "./run-metrics";
import { DeleteRunButton, RestoreRunButton } from "./run-actions";
import { ShareButton } from "./share-button";

const STATUS_MAP: Record<string, { label: string; class: string; icon: any }> = {
  pending:   { label: "In attesa",   class: "badge-muted",    icon: Clock },
  running:   { label: "In corso",    class: "badge-primary",  icon: Loader2 },
  completed: { label: "Completata",  class: "badge-success",  icon: CheckCircle },
  failed:    { label: "Fallita",     class: "badge badge-muted text-destructive border-destructive/20 bg-destructive/10", icon: XCircle },
  cancelled: { label: "Annullata",   class: "badge-muted",    icon: XCircle },
};

export default async function RunDetailPage({ params }: { params: { id: string; runId: string } }) {
  const supabase = createServerClient();

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", params.runId)
    .single();

  if (!run) notFound();
  const r = run as any;

  const { data: project } = await supabase
    .from("projects")
    .select("name, target_brand")
    .eq("id", params.id)
    .single();

  const { data: avi } = await supabase
    .from("avi_history")
    .select("*")
    .eq("run_id", params.runId)
    .single();

  // Trend vs previous run (exclude archived runs)
  let trend: number | null = null;
  if (avi) {
    // Get run IDs of non-deleted runs
    const { data: activeRuns } = await supabase
      .from("analysis_runs")
      .select("id")
      .eq("project_id", params.id)
      .is("deleted_at", null);
    const activeRunIds = (activeRuns ?? []).map((r: any) => r.id);

    const { data: allAvi } = activeRunIds.length > 0
      ? await supabase
          .from("avi_history")
          .select("avi_score, computed_at")
          .eq("project_id", params.id)
          .in("run_id", activeRunIds)
          .order("computed_at", { ascending: false })
          .limit(2)
      : { data: [] };
    if (allAvi && allAvi.length >= 2) {
      trend = (allAvi[0] as any).avi_score - (allAvi[1] as any).avi_score;
    }
  }

  const { data: prompts } = await supabase
    .from("prompts_executed")
    .select("*")
    .eq("run_id", params.runId)
    .order("created_at", { ascending: true });

  const promptIds = (prompts ?? []).map((p: any) => p.id);

  const { data: analyses } = promptIds.length > 0
    ? await supabase.from("response_analysis").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };

  const { data: sources } = promptIds.length > 0
    ? await supabase.from("sources").select("*").in("prompt_executed_id", promptIds)
    : { data: [] };

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("project_id", params.id)
    .eq("discovered_at_run_id", params.runId);

  // Fetch competitor mentions for this run
  const { data: competitorMentions } = await (supabase.from("competitor_mentions") as any)
    .select("*")
    .eq("run_id", params.runId);

  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .eq("project_id", params.id)
    .eq("first_seen_run_id", params.runId);

  const mentionsList = (competitorMentions ?? []) as any[];
  const analysesList = (analyses ?? []) as any[];

  // Error stats for banner
  const errorPrompts = (prompts ?? []).filter((p: any) => p.error);
  const errorCount = errorPrompts.length;
  const hasGeminiErrors = errorPrompts.some((p: any) =>
    (p.model as string)?.toLowerCase().includes("gemini") ||
    (p.error as string)?.toLowerCase().includes("gemini")
  );
  const hasGptErrors = errorPrompts.some((p: any) =>
    (p.model as string)?.toLowerCase().includes("gpt") ||
    (p.model as string)?.toLowerCase().startsWith("o1") ||
    (p.model as string)?.toLowerCase().startsWith("o3")
  );
  const hasQuotaErrors = errorPrompts.some((p: any) => {
    const err = (p.error as string)?.toLowerCase() ?? "";
    return err.includes("429") || err.includes("quota") || err.includes("rate");
  });

  // Unique models for filter pills
  const models = Array.from(new Set((prompts ?? []).map((p: any) => p.model as string)));

  // Compute per-model AVI (for multi-model runs)
  const perModelAvi: { model: string; avi: number }[] = [];
  if (models.length > 1 && analysesList.length > 0) {
    const promptsList = (prompts ?? []) as any[];
    for (const model of models) {
      const modelPromptIds = new Set(promptsList.filter((p: any) => p.model === model).map((p: any) => p.id));
      const modelAnalyses = analysesList.filter((a: any) => modelPromptIds.has(a.prompt_executed_id));
      if (modelAnalyses.length === 0) continue;
      const mentioned = modelAnalyses.filter((a: any) => a.brand_mentioned).length;
      const presence = (mentioned / modelAnalyses.length) * 100;
      const rankVals = modelAnalyses.map((a: any) => {
        if (!a.brand_mentioned || !a.brand_rank || a.brand_rank <= 0) return 0;
        return 1 / a.brand_rank;
      });
      const avgRankInv = rankVals.reduce((s: number, v: number) => s + v, 0) / rankVals.length;
      const rankS = avgRankInv * 100;
      const withSent = modelAnalyses.filter((a: any) => a.sentiment_score != null);
      const sentAvg = withSent.length > 0 ? withSent.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSent.length : 0.5;
      const sentS = ((sentAvg + 1) / 2) * 100;
      const modelAvi = Math.round((presence * 0.35 + rankS * 0.25 + sentS * 0.20 + 100 * 0.20) * 10) / 10;
      perModelAvi.push({ model, avi: Math.max(0, Math.min(100, modelAvi)) });
    }
  }

  const statusInfo = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;
  const proj = project as any;
  const aviData = avi as any;

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <RunAutoRefresh status={r.status} />

      {/* Archived banner */}
      {r.deleted_at && (
        <div className="card border-muted bg-muted/30 p-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Questa analisi &egrave; archiviata e non viene inclusa nei calcoli AVI.
            </span>
          </div>
          <RestoreRunButton runId={params.runId} />
        </div>
      )}

      {/* Error banner */}
      {errorCount > 0 && (
        <div className="card border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm">
          <span className="text-destructive font-mono text-xs">&#9888;</span>
          <span className="text-destructive">
            {errorCount} prompt falliti
            {hasGeminiErrors && hasQuotaErrors ? " — Gemini: quota esaurita (rate limit)" : hasGeminiErrors ? " — Gemini: errore API" : ""}
            {hasGptErrors ? " — GPT: errore API" : ""}
            {!hasGeminiErrors && !hasGptErrors ? " — Errore API" : ""}
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <a
          href={`/projects/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al progetto
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Analisi v{r.version}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{proj?.name} &middot; {proj?.target_brand}</p>
          </div>
          <div className="flex items-center gap-2">
            {r.status === "completed" && <ExportButtons runId={params.runId} />}
            {r.status === "completed" && (
              <ShareButton runId={params.runId} initialToken={(r as any).share_token} />
            )}
            {(r.status === "completed" || r.status === "failed" || r.status === "cancelled") && !r.deleted_at && (
              <DeleteRunButton runId={params.runId} projectId={params.id} />
            )}
            <span className={`badge ${statusInfo.class} flex items-center gap-1`}>
              <StatusIcon className={`w-3.5 h-3.5 ${r.status === "running" ? "animate-spin" : ""}`} />
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Run metadata */}
      <div className="card p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div><span className="text-muted-foreground">Modelli:</span>{" "}<span className="text-foreground font-medium">{r.models_used?.join(", ")}</span></div>
        <div><span className="text-muted-foreground">Prompt:</span>{" "}<span className="text-foreground font-medium">{r.completed_prompts}/{r.total_prompts}</span></div>
        <div><span className="text-muted-foreground">Run per prompt:</span>{" "}<span className="text-foreground font-medium">{r.run_count}</span></div>
        {r.started_at && <div><span className="text-muted-foreground">Inizio:</span>{" "}<span className="text-foreground">{new Date(r.started_at).toLocaleString("it-IT")}</span></div>}
        {r.completed_at && <div><span className="text-muted-foreground">Fine:</span>{" "}<span className="text-foreground">{new Date(r.completed_at).toLocaleString("it-IT")}</span></div>}
      </div>

      {/* Loading banner when running */}
      {r.status === "running" && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <img
            src="/loading.gif"
            alt="loading"
            className="w-full max-w-2xl object-contain"
          />
          <p className="text-sm text-muted-foreground animate-pulse">
            Analisi in corso...
          </p>
        </div>
      )}

      {/* AVI Score: Ring + Component Bars */}
      {aviData && (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
          <div className="space-y-3">
            <RunAVIRing
              score={aviData.avi_score}
              trend={trend}
              components={[
                { label: "Prominence", v: aviData.presence_score != null ? Math.round(aviData.presence_score) : null },
                { label: "Rank",       v: aviData.rank_score != null ? Math.round(aviData.rank_score) : null },
                { label: "Sentiment",  v: aviData.sentiment_score != null ? Math.round(aviData.sentiment_score) : null },
                { label: "Consistency", v: aviData.stability_score != null ? Math.round(aviData.stability_score) : null },
              ]}
            />
          </div>
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground">Componenti AVI</h2>
            <div className="space-y-3">
              {[
                { label: "Prominence", value: Math.round(aviData.presence_score ?? 0), color: "#e8956d" },
                { label: "Rank", value: Math.round(aviData.rank_score ?? 0), color: "#7eb3d4" },
                { label: "Sentiment", value: Math.round(aviData.sentiment_score ?? 0), color: "#7eb89a" },
                { label: "Consistency", value: Math.round(aviData.stability_score ?? 0), color: "#c4a882" },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium text-foreground">{Math.round(c.value)}</span>
                  </div>
                  <div className="h-2 rounded-[2px] bg-muted overflow-hidden">
                    <div className="h-full rounded-[2px] transition-all duration-700" style={{ width: `${Math.min(100, c.value)}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filterable metrics, competitors, topics, sources, prompts */}
      <RunMetrics
        prompts={prompts ?? []}
        analyses={analyses ?? []}
        sources={sources ?? []}
        models={models}
        competitorMentions={mentionsList}
        brandAviScore={aviData?.avi_score ?? 0}
        targetBrand={proj?.target_brand ?? ""}
        perModelAvi={perModelAvi}
      />
    </div>
  );
}

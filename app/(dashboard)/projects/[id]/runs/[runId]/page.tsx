export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Archive } from "lucide-react";
import { ExportButtons } from "./export-buttons";
import { RunAutoRefresh } from "./run-auto-refresh";
import { DeleteRunButton, RestoreRunButton } from "./run-actions";
import { ShareButton } from "./share-button";
import { TranslatedStatus, TranslatedLabel } from "./run-i18n";
import { RunDetailClient } from "./run-detail-client";

const STATUS_MAP: Record<string, { label: string; class: string; icon: any }> = {
  pending:   { label: "In attesa",   class: "badge-muted",    icon: Clock },
  running:   { label: "In corso",    class: "badge-primary",  icon: Loader2 },
  completed: { label: "Completata",  class: "badge-success",  icon: CheckCircle },
  failed:    { label: "Fallita",     class: "badge badge-muted text-destructive border-destructive/20 bg-destructive/10", icon: XCircle },
  cancelled: { label: "Annullata",   class: "badge-muted",    icon: XCircle },
};

// AVI_MAIN_COMPONENTS moved to run-detail-client.tsx

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
  let totalActiveRuns = 1;
  if (avi) {
    const { data: activeRuns } = await supabase
      .from("analysis_runs")
      .select("id")
      .eq("project_id", params.id)
      .is("deleted_at", null);
    const activeRunIds = (activeRuns ?? []).map((r: any) => r.id);
    totalActiveRuns = activeRunIds.length;

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

  const { data: competitorMentions } = await (supabase.from("competitor_mentions") as any)
    .select("*")
    .eq("run_id", params.runId);

  // Fetch competitor AVI scores from DB (pre-computed by inngest)
  // Use service client: competitor_avi table was created via exec_sql and may lack
  // GRANT/RLS policies for the authenticated role.
  const svc = createServiceClient();
  console.log("[DEBUG competitor_avi] BEFORE query — params.runId:", params.runId, "type:", typeof params.runId);
  const { data: competitorAviData, error: competitorAviError } = await (svc.from("competitor_avi") as any)
    .select("competitor_name, avi_score, prominence_score, rank_score, sentiment_score, consistency_score, mention_count")
    .eq("run_id", params.runId);

  // DEBUG: trace competitor_avi fetch (check Vercel server logs)
  console.log("[DEBUG competitor_avi] AFTER query — error:", competitorAviError);
  console.log("[DEBUG competitor_avi] AFTER query — row count:", competitorAviData?.length ?? "null");
  console.log("[DEBUG competitor_avi] AFTER query — raw data:", JSON.stringify(competitorAviData));
  console.log("[DEBUG competitor_avi] AFTER query — svc url:", process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30));

  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .eq("project_id", params.id)
    .eq("first_seen_run_id", params.runId);

  // Fetch queries for funnel stage info
  const queryIds = Array.from(new Set((prompts ?? []).map((p: any) => p.query_id).filter(Boolean)));
  const { data: queries } = queryIds.length > 0
    ? await supabase.from("queries").select("id, text, funnel_stage").in("id", queryIds)
    : { data: [] };

  // Fetch audience segments for this project
  const segmentIds = Array.from(new Set((prompts ?? []).map((p: any) => p.segment_id).filter(Boolean)));
  const { data: segments } = segmentIds.length > 0
    ? await (supabase.from("audience_segments") as any).select("id, label, name, prompt_context").in("id", segmentIds)
    : { data: [] };

  const mentionsList = (competitorMentions ?? []) as any[];
  const analysesList = (analyses ?? []) as any[];

  // Error stats for banner
  const skippedPrompts = (prompts ?? []).filter((p: any) => p.error?.includes("SKIPPED"));
  const errorPrompts = (prompts ?? []).filter((p: any) => p.error && !p.error.includes("SKIPPED"));
  const errorCount = errorPrompts.length;
  const skippedCount = skippedPrompts.length;
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

  // Stability data: check if run_count >= 3
  const runCount = r.run_count ?? 1;

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
              <TranslatedLabel tkey="runDetail.archived" />
            </span>
          </div>
          <RestoreRunButton runId={params.runId} />
        </div>
      )}

      {/* Skipped banner */}
      {skippedCount > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2 text-sm">
          <span className="text-amber-600 font-mono text-xs">&#9888;</span>
          <span className="text-amber-600">
            {skippedCount} prompt saltati &mdash; credenziali mancanti (es. Azure)
          </span>
        </div>
      )}

      {/* Error banner */}
      {errorCount > 0 && (
        <div className="card border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm">
          <span className="text-destructive font-mono text-xs">&#9888;</span>
          <span className="text-destructive">
            {errorCount} prompt falliti
            {hasGeminiErrors && hasQuotaErrors ? " \u2014 Gemini: quota esaurita (rate limit)" : hasGeminiErrors ? " \u2014 Gemini: errore API" : ""}
            {hasGptErrors ? " \u2014 GPT: errore API" : ""}
            {!hasGeminiErrors && !hasGptErrors ? " \u2014 Errore API" : ""}
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
          <TranslatedLabel tkey="nav.backToProject" />
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground"><TranslatedLabel tkey="runDetail.analysisVersion" /> v{r.version}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {proj?.name === proj?.target_brand ? proj?.name : `${proj?.name} \u00B7 ${proj?.target_brand}`}
            </p>
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
              <TranslatedStatus status={r.status} />
            </span>
          </div>
        </div>
      </div>

      {/* Run metadata */}
      <div className="card p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm break-words">
        <div className="flex flex-wrap items-center gap-1"><span className="text-muted-foreground"><TranslatedLabel tkey="runDetail.modelsLabel" />:</span>{" "}<span className="text-foreground font-medium break-words">{r.models_used?.join(", ")}</span></div>
        <div><span className="text-muted-foreground"><TranslatedLabel tkey="runDetail.promptLabel" />:</span>{" "}<span className="text-foreground font-medium">{r.completed_prompts}/{r.total_prompts}</span></div>
        <div><span className="text-muted-foreground"><TranslatedLabel tkey="runDetail.runsPerPrompt" />:</span>{" "}<span className="text-foreground font-medium">{r.run_count}</span></div>
        {r.started_at && <div><span className="text-muted-foreground"><TranslatedLabel tkey="runDetail.startLabel" />:</span>{" "}<span className="text-foreground" suppressHydrationWarning>{new Date(r.started_at).toLocaleString("it-IT")}</span></div>}
        {r.completed_at && <div><span className="text-muted-foreground"><TranslatedLabel tkey="runDetail.endLabel" />:</span>{" "}<span className="text-foreground" suppressHydrationWarning>{new Date(r.completed_at).toLocaleString("it-IT")}</span></div>}
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
            <TranslatedLabel tkey="runDetail.analysisInProgress" />
          </p>
        </div>
      )}

      {/* AVI + Model filter + Metrics — all controlled by shared model selector */}
      <RunDetailClient
        aviData={aviData}
        trend={trend}
        totalActiveRuns={totalActiveRuns}
        prompts={prompts ?? []}
        analyses={analyses ?? []}
        sources={sources ?? []}
        models={models}
        competitorMentions={mentionsList}
        targetBrand={proj?.target_brand ?? ""}
        queries={queries ?? []}
        competitorAviData={competitorAviData ?? []}
        segments={(segments ?? []) as any[]}
        runCount={runCount}
      />
    </div>
  );
}

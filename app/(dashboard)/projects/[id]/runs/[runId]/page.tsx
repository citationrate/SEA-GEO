import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Archive } from "lucide-react";
import { RunAVIRing } from "./run-avi-ring";
import { ExportButtons } from "./export-buttons";
import { RunAutoRefresh } from "./run-auto-refresh";
import { RunMetrics } from "./run-metrics";
import { DeleteRunButton, RestoreRunButton } from "./run-actions";
import { ShareButton } from "./share-button";
import { StabilitySection } from "./stability-section";
import { SegmentSection } from "./segment-section";
import { AVIBars } from "./avi-bars";

const STATUS_MAP: Record<string, { label: string; class: string; icon: any }> = {
  pending:   { label: "In attesa",   class: "badge-muted",    icon: Clock },
  running:   { label: "In corso",    class: "badge-primary",  icon: Loader2 },
  completed: { label: "Completata",  class: "badge-success",  icon: CheckCircle },
  failed:    { label: "Fallita",     class: "badge badge-muted text-destructive border-destructive/20 bg-destructive/10", icon: XCircle },
  cancelled: { label: "Annullata",   class: "badge-muted",    icon: XCircle },
};

const AVI_COMPONENTS = [
  { key: "presence_score",   label: "Presenza",   color: "#e8956d", desc: "% risposte AI in cui il brand viene citato" },
  { key: "rank_score",       label: "Posizione",  color: "#7eb3d4", desc: "Posizione media mediata su tutti i prompt" },
  { key: "sentiment_score",  label: "Sentiment",  color: "#7eb89a", desc: "Tono delle citazioni mediato su tutti i prompt" },
];

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

  const { data: competitorMentions } = await (supabase.from("competitor_mentions") as any)
    .select("*")
    .eq("run_id", params.runId);

  // Fetch competitor AVI scores from DB (pre-computed by inngest)
  const { data: competitorAviData } = await (supabase.from("competitor_avi") as any)
    .select("competitor_name, avi_score, presence_score, rank_score, sentiment_score, consistency_score, mention_count")
    .eq("run_id", params.runId);

  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .eq("project_id", params.id)
    .eq("first_seen_run_id", params.runId);

  // Fetch queries for funnel stage info
  const queryIds = Array.from(new Set((prompts ?? []).map((p: any) => p.query_id).filter(Boolean)));
  const { data: queries } = queryIds.length > 0
    ? await supabase.from("queries").select("id, text, funnel_stage, family").in("id", queryIds)
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
              Questa analisi &egrave; archiviata e non viene inclusa nei calcoli AVI.
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
          Torna al progetto
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Analisi v{r.version}</h1>
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
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Run metadata */}
      <div className="card p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm break-words">
        <div className="flex flex-wrap items-center gap-1"><span className="text-muted-foreground">Modelli:</span>{" "}<span className="text-foreground font-medium break-words">{r.models_used?.join(", ")}</span></div>
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

      {/* AVI Score: Ring + Component Breakdown */}
      {aviData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
            <div className="space-y-3">
              <RunAVIRing
                score={aviData.avi_score}
                trend={trend}
                noBrandMentions={aviData.avi_score === 0 && aviData.presence_score === 0}
                components={[
                  { label: "Presenza",   v: aviData.presence_score != null ? Math.round(aviData.presence_score) : null },
                  { label: "Posizione",  v: aviData.rank_score != null ? Math.round(aviData.rank_score) : null },
                  { label: "Sentiment",  v: aviData.sentiment_score != null ? Math.round(aviData.sentiment_score) : null },
                  { label: "Affidabilità", v: aviData.stability_score != null ? Math.round(aviData.stability_score) : null },
                ]}
              />
            </div>

            {/* AVI Component Cards */}
            <AVIBars items={AVI_COMPONENTS.map((c) => ({
              label: c.label,
              color: c.color,
              desc: c.desc,
              value: aviData[c.key] != null ? Math.round(aviData[c.key]) : null,
            }))} />
          </div>

          {/* Consistency badge */}
          {aviData.stability_score != null && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[12px] font-medium ${
                aviData.stability_score > 80
                  ? "bg-green-500/15 text-green-400 border border-green-500/30"
                  : aviData.stability_score >= 50
                  ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                  : "bg-red-500/15 text-red-400 border border-red-500/30"
              }`}>
                Affidabilità: {Math.round(aviData.stability_score)}
                {aviData.stability_score > 80 ? " — Alta affidabilità" : aviData.stability_score >= 50 ? " — Affidabilità media" : " — Bassa affidabilità — esegui più run"}
              </span>
              <span className="text-xs text-muted-foreground">Stabilità delle risposte tra run diverse. Non influisce sull&apos;AVI.</span>
            </div>
          )}

          {/* AVI Component Comparison Bar */}
          <div className="card p-5 space-y-3">
            <h2 className="font-display font-semibold text-foreground text-sm">Confronto Componenti AVI</h2>
            <div className="flex items-end gap-4 h-32">
              {AVI_COMPONENTS.map((c) => {
                const value = aviData[c.key] != null ? Math.round(aviData[c.key]) : 0;
                return (
                  <div key={c.key} className="flex-1 flex flex-col items-center gap-1">
                    <span className="font-mono text-[12px] font-bold text-foreground">{value}</span>
                    <div className="w-full rounded-t-[2px] transition-all duration-700" style={{ height: `${value}%`, backgroundColor: c.color }} />
                    <span className="font-mono text-[11px] text-muted-foreground text-center">{c.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
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
        queries={queries ?? []}
        competitorAviData={competitorAviData ?? []}
      />

      {/* Segment/Persona analysis (only if segments are present) */}
      {(segments ?? []).length > 0 && (
        <SegmentSection
          prompts={prompts ?? []}
          analyses={analyses ?? []}
          segments={segments ?? []}
          queries={queries ?? []}
        />
      )}

      {/* Stability section (only if 3+ runs per prompt) */}
      {runCount >= 3 && (
        <StabilitySection
          prompts={prompts ?? []}
          analyses={analyses ?? []}
          queries={queries ?? []}
          runCount={runCount}
        />
      )}
    </div>
  );
}

import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, MessageSquare, Users, BarChart3, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Cpu, Settings, Sparkles } from "lucide-react";
import { AnalysisLauncher } from "./analysis-launcher";
import { AnalysisProgress } from "./analysis-progress";
import { ProjectAVITrend } from "./project-avi-trend";
import { DeleteProjectButton } from "./delete-project-button";
import { OpenAnalysisButton } from "./open-analysis-button";
import { ArchivedRunsSection } from "./archived-runs-section";
import { AutoLaunch } from "./auto-launch";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  const { data: queries } = await supabase
    .from("queries")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const { data: segments } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("project_id", params.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Fetch all runs (active + archived)
  const { data: allRunsRaw } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const allRuns = (allRunsRaw ?? []).filter((r: any) => !r.deleted_at);
  const archivedRuns = (allRunsRaw ?? []).filter((r: any) => r.deleted_at);

  const lastRun = allRuns[0] ?? null;

  // AVI history: only from active runs
  const activeRunIds = allRuns.map((r: any) => r.id);

  const { data: lastAvi } = activeRunIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("*")
        .eq("project_id", params.id)
        .in("run_id", activeRunIds)
        .order("computed_at", { ascending: false })
        .limit(1)
        .single()
    : { data: null };

  // Fetch AVI history for trend chart (only active runs)
  const { data: aviHistory } = activeRunIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("*")
        .eq("project_id", params.id)
        .in("run_id", activeRunIds)
        .order("computed_at", { ascending: true })
    : { data: [] };

  const aviMap = new Map((aviHistory ?? []).map((a: any) => [a.run_id, a.avi_score]));

  // Get all unique models across runs
  const allModels = Array.from(new Set(allRuns.flatMap((r: any) => r.models_used ?? [])));

  // Build per-model AVI for trend chart
  const perModelAviByRun = new Map<string, Record<string, number>>();
  if (allModels.length > 1) {
    for (const run of allRuns as any[]) {
      if (run.status !== "completed") continue;
      const { data: runPrompts } = await supabase
        .from("prompts_executed")
        .select("id, model, query_id, segment_id, run_number")
        .eq("run_id", run.id);
      const rPrompts = (runPrompts ?? []) as any[];
      const rPromptIds = rPrompts.map((p: any) => p.id);
      if (rPromptIds.length === 0) continue;
      const { data: runAnalyses } = await supabase
        .from("response_analysis")
        .select("prompt_executed_id, brand_mentioned, brand_rank, sentiment_score")
        .in("prompt_executed_id", rPromptIds);
      const rAnalyses = (runAnalyses ?? []) as any[];
      const promptMap = new Map(rPrompts.map((p: any) => [p.id, p]));
      const modelAvis: Record<string, number> = {};
      for (const model of (run.models_used ?? []) as string[]) {
        const modelPromptIds = new Set(rPrompts.filter((p: any) => p.model === model).map((p: any) => p.id));
        const modelAnalyses = rAnalyses.filter((a: any) => modelPromptIds.has(a.prompt_executed_id));
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
        modelAvis[model] = Math.round((presence * 0.35 + rankS * 0.25 + sentS * 0.20 + 100 * 0.20) * 10) / 10;
      }
      perModelAviByRun.set(run.id, modelAvis);
    }
  }

  // Build trend data for chart
  const trendData = (aviHistory ?? []).map((a: any, i: number) => {
    const point: any = {
      version: `v${i + 1}`,
      avi: Math.round(a.avi_score * 10) / 10,
      presence: Math.round(a.presence_score),
      sentiment: Math.round(a.sentiment_score),
    };
    const modelAvis = perModelAviByRun.get(a.run_id);
    if (modelAvis) {
      for (const [model, score] of Object.entries(modelAvis)) {
        point[model] = score;
      }
    }
    return point;
  });

  const tofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "tofu");
  const mofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "mofu");

  const proj = project as any;
  const runningRun = allRuns.find((r: any) => r.status === "running") as any | undefined;

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <AutoLaunch />
      <div>
        <a
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai progetti
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">{proj.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {proj.target_brand}
              {proj.country && <> &middot; {proj.country}</>}
              {" "}&middot; {(proj.language as string).toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/projects/${params.id}/edit`}
              className="flex items-center gap-1.5 bg-surface border border-border text-muted-foreground text-sm font-medium px-3 py-2 rounded-[2px] hover:border-primary/30 hover:text-foreground transition-colors"
              title="Modifica Progetto"
            >
              <Settings className="w-4 h-4" />
              Modifica
            </a>
            <AnalysisLauncher
              projectId={params.id}
              hasQueries={(queries ?? []).length > 0}
              queryCount={(queries ?? []).length}
              segmentCount={(segments ?? []).length}
              modelsConfig={(proj.models_config as string[]) ?? ["gpt-4o-mini"]}
            />
          </div>
        </div>
      </div>

      {/* Modelli AI configurati */}
      <div className="flex items-center gap-2 flex-wrap">
        <Cpu className="w-3.5 h-3.5 text-cream-dim" />
        <span className="font-mono text-[11px] text-cream-dim">Modelli AI:</span>
        {((proj.models_config as string[]) ?? ["gpt-4o-mini"]).map((m: string) => (
          <span key={m} className="badge badge-primary text-[10px]">{m}</span>
        ))}
      </div>

      {/* AVI Score + Last Run */}
      {lastAvi && (
        <div className="card p-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">AVI Score</p>
              <p className="font-display font-bold text-3xl text-primary">{(lastAvi as any).avi_score}</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="grid grid-cols-4 gap-4 flex-1">
              {[
                { label: "Presence", value: (lastAvi as any).presence_score },
                { label: "Rank", value: (lastAvi as any).rank_score },
                { label: "Sentiment", value: (lastAvi as any).sentiment_score },
                { label: "Stability", value: (lastAvi as any).stability_score },
              ].map((c) => (
                <div key={c.label} className="text-center">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-display font-semibold text-foreground">{Math.round(c.value || 0)}</p>
                </div>
              ))}
            </div>
          </div>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Ultima analisi: {new Date((lastRun as any).completed_at ?? (lastRun as any).created_at).toLocaleString("it-IT")}
              {" "}&middot; v{(lastRun as any).version}
              {" "}&middot; <span className="badge badge-success text-[10px]">{(lastRun as any).status}</span>
            </p>
          )}
        </div>
      )}

      {/* Failed run banner */}
      {lastRun && (lastRun as any).status === "failed" && (
        <div className="flex items-center gap-3 rounded-[2px] border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              L&apos;ultima analisi non è andata a buon fine.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(lastRun as any).error_message
                ? (lastRun as any).error_message
                : (lastRun as any).completed_prompts === 0
                  ? "Analisi interrotta prima di iniziare — probabilmente un problema di connessione."
                  : `Analisi parziale — completati ${(lastRun as any).completed_prompts}/${(lastRun as any).total_prompts} prompt prima dell'interruzione.`}
            </p>
          </div>
          <OpenAnalysisButton />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query TOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Query TOFU</h2>
              <span className="badge badge-muted text-[10px]">{tofuQueries.length}</span>
            </div>
            <a href={`/projects/${params.id}/queries`} data-tour="add-query-btn" className="text-xs text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessuna query TOFU</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q: any) => (
                <QueryBadgeItem key={q.id} query={q} />
              ))}
            </ul>
          )}
        </div>

        {/* Query MOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h2 className="font-display font-semibold text-foreground">Query MOFU</h2>
              <span className="badge badge-muted text-[10px]">{mofuQueries.length}</span>
            </div>
            <a href={`/projects/${params.id}/queries`} className="text-xs text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {mofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessuna query MOFU</p>
          ) : (
            <ul className="space-y-2">
              {mofuQueries.map((q: any) => (
                <QueryBadgeItem key={q.id} query={q} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Segmenti audience */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Segmenti Audience Attivi</h2>
            <span className="badge badge-muted text-[10px]">{(segments ?? []).length}</span>
          </div>
          <a href={`/projects/${params.id}/segments`} className="text-xs text-primary hover:text-primary/70 transition-colors">Gestisci</a>
        </div>
        {!(segments ?? []).length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nessun segmento attivo</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(segments ?? []).map((s: any) => (
              <div key={s.id} className="bg-muted rounded-[2px] px-3 py-2 border border-border">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.prompt_context}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analisi eseguite */}
      {allRuns.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Analisi Eseguite</h2>
            <span className="badge badge-muted text-[10px]">{allRuns.length}</span>
          </div>
          <div className="space-y-2">
            {allRuns.map((run: any) => {
              const Icon = run.status === "completed" ? CheckCircle : run.status === "failed" ? XCircle : run.status === "running" ? Loader2 : Clock;
              const badgeClass = run.status === "completed"
                ? "bg-green-500/15 text-green-500 border-green-500/30"
                : run.status === "running"
                ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
                : run.status === "failed"
                ? "bg-red-500/15 text-red-500 border-red-500/30"
                : "badge-muted";
              const statusLabel = run.status === "completed" ? "Completata" : run.status === "running" ? "In corso" : run.status === "failed" ? "Fallita" : run.status;
              const aviScore = aviMap.get(run.id);
              return (
                <div key={run.id} className="space-y-1">
                  <a
                    href={`/projects/${params.id}/runs/${run.id}`}
                    className="flex items-center justify-between bg-muted rounded-[2px] px-4 py-3 border border-border hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">v{run.version}</span>
                      {aviScore != null && (
                        <span className="font-display font-bold text-primary text-sm">AVI {aviScore}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{run.models_used?.join(", ")}</span>
                      <span className="text-xs text-muted-foreground">{run.completed_prompts}/{run.total_prompts} prompt</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{new Date(run.completed_at ?? run.created_at).toLocaleDateString("it-IT")}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[2px] border ${badgeClass}`}>
                        <Icon className={`w-3 h-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                        {statusLabel}
                      </span>
                    </div>
                  </a>
                  {run.status === "failed" && (
                    <p className="text-xs text-muted-foreground px-4">
                      {run.completed_prompts === 0
                        ? "Analisi interrotta prima di iniziare — probabilmente un problema di connessione."
                        : `Analisi parziale — completati ${run.completed_prompts}/${run.total_prompts} prompt prima dell'interruzione.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AVI Trend Chart */}
      {trendData.length > 0 && (
        <ProjectAVITrend data={trendData} models={allModels} />
      )}

      {/* Archived runs */}
      {archivedRuns.length > 0 && (
        <ArchivedRunsSection
          runs={archivedRuns.map((run: any) => ({
            id: run.id,
            version: run.version,
            status: run.status,
            models_used: run.models_used,
            completed_prompts: run.completed_prompts,
            total_prompts: run.total_prompts,
            date: new Date(run.completed_at ?? run.created_at).toLocaleDateString("it-IT"),
          }))}
          projectId={params.id}
        />
      )}

      {/* Azioni */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <a
            href={`/projects/${params.id}/queries`}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:border-primary/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova Query
          </a>
          <a
            href={`/projects/${params.id}/queries/generate`}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Genera con AI
          </a>
          <a
            href={`/projects/${params.id}/segments`}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:border-primary/30 transition-colors"
          >
            <Users className="w-4 h-4" />
            Segmenti
          </a>
        </div>
        <DeleteProjectButton projectId={params.id} projectName={proj.name} />
      </div>

      {runningRun && (
        <AnalysisProgress
          runId={runningRun.id}
          projectId={params.id}
          completedPrompts={runningRun.completed_prompts ?? 0}
          totalPrompts={runningRun.total_prompts ?? 1}
        />
      )}
    </div>
  );
}

const SET_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  generale: { label: "GEN", cls: "border-muted-foreground/30 text-muted-foreground" },
  verticale: { label: "VERT", cls: "border-blue-500/30 text-blue-400" },
  persona: { label: "PERS", cls: "border-purple-500/30 text-purple-400" },
};

function QueryBadgeItem({ query }: { query: any }) {
  const setType = query.set_type || "manual";
  const badge = SET_TYPE_BADGE[setType];
  return (
    <li className="flex items-start justify-between gap-2 text-sm text-foreground bg-muted rounded-[2px] px-3 py-2 border border-border">
      <span className="flex-1 min-w-0">{query.text}</span>
      {badge && (
        <span className={`font-mono text-[0.5rem] tracking-wide uppercase px-1 py-0.5 rounded-[2px] border shrink-0 mt-0.5 ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </li>
  );
}

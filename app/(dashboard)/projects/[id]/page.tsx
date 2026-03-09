import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, MessageSquare, Users, BarChart3, CheckCircle, XCircle, Clock, Loader2, AlertTriangle } from "lucide-react";
import { AnalysisLauncher } from "./analysis-launcher";
import { AnalysisProgress } from "./analysis-progress";
import { ProjectAVITrend } from "./project-avi-trend";
import { DeleteProjectButton } from "./delete-project-button";
import { RetryAnalysisButton } from "./retry-analysis-button";

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

  const { data: allRuns } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const lastRun = (allRuns ?? [])[0] ?? null;

  const { data: lastAvi } = await supabase
    .from("avi_history")
    .select("*")
    .eq("project_id", params.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch all AVI history for trend chart + run scores
  const { data: aviHistory } = await supabase
    .from("avi_history")
    .select("*")
    .eq("project_id", params.id)
    .order("computed_at", { ascending: true });

  const aviMap = new Map((aviHistory ?? []).map((a: any) => [a.run_id, a.avi_score]));

  // Build trend data for chart
  const trendData = (aviHistory ?? []).map((a: any, i: number) => ({
    version: `v${i + 1}`,
    avi: Math.round(a.avi_score * 10) / 10,
    presence: Math.round(a.presence_score),
    sentiment: Math.round(a.sentiment_score),
  }));

  const tofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "tofu");
  const mofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "mofu");

  const proj = project as any;
  const runningRun = (allRuns ?? []).find((r: any) => r.status === "running") as any | undefined;

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
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
          <AnalysisLauncher
            projectId={params.id}
            hasQueries={(queries ?? []).length > 0}
            hasSegments={(segments ?? []).length > 0}
            queryCount={(queries ?? []).length}
            segmentCount={(segments ?? []).length}
          />
        </div>
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
                  <p className="font-display font-semibold text-foreground">{Math.round((c.value || 0) * 100)}</p>
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
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              L&apos;ultima analisi non è andata a buon fine.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(lastRun as any).completed_prompts === 0
                ? "Analisi interrotta prima di iniziare — probabilmente un problema di connessione."
                : `Analisi parziale — completati ${(lastRun as any).completed_prompts}/${(lastRun as any).total_prompts} prompt prima dell'interruzione.`}
            </p>
          </div>
          <RetryAnalysisButton
            projectId={params.id}
            modelsUsed={(lastRun as any).models_used ?? []}
            runCount={(lastRun as any).run_count ?? 1}
          />
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
            <a href={`/projects/${params.id}/queries`} className="text-xs text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessuna query TOFU</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q: any) => (
                <li key={q.id} className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 border border-border">{q.text}</li>
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
                <li key={q.id} className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 border border-border">{q.text}</li>
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
              <div key={s.id} className="bg-muted rounded-lg px-3 py-2 border border-border">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.prompt_context}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analisi eseguite */}
      {(allRuns ?? []).length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Analisi Eseguite</h2>
            <span className="badge badge-muted text-[10px]">{(allRuns ?? []).length}</span>
          </div>
          <div className="space-y-2">
            {(allRuns ?? []).map((run: any) => {
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
                    className="flex items-center justify-between bg-muted rounded-lg px-4 py-3 border border-border hover:border-primary/30 transition-colors group"
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
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
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
        <ProjectAVITrend data={trendData} />
      )}

      {/* Azioni */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <a
            href={`/projects/${params.id}/queries`}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:border-primary/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova Query
          </a>
          <a
            href={`/projects/${params.id}/segments`}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:border-primary/30 transition-colors"
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
          completedPrompts={runningRun.completed_prompts ?? 0}
          totalPrompts={runningRun.total_prompts ?? 1}
        />
      )}
    </div>
  );
}

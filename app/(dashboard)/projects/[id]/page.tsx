import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Plus, MessageSquare, Users, BarChart3, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Cpu, Settings, Sparkles, Info } from "lucide-react";
import { AnalysisLauncher } from "./analysis-launcher";
import { ProjectAVITrend } from "./project-avi-trend";
import { DeleteProjectButton } from "./delete-project-button";
import { OpenAnalysisButton } from "./open-analysis-button";
import { ArchivedRunsSection } from "./archived-runs-section";
import { AutoLaunch } from "./auto-launch";
import { ProjectOnboardingChecklist } from "./onboarding-checklist";
import { T } from "@/components/translated-label";
import { BotMount } from "@/components/BotMount";
import { buildProjectContext, normalizeLang } from "@/lib/bot-context";
import { getEffectivePlanId } from "@/lib/utils/is-pro";
import { PROVIDER_GROUPS, PRO_ONLY_MODEL_IDS, MODEL_MAP } from "@citationrate/llm-client";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const auth = createServerClient();
  // Cookie-only auth — middleware already gates this route.
  const { data: { session } } = await auth.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const supabase = createDataClient();

  // ── Phase 1: project itself (everything else hangs off its existence) ──
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // ── Phase 2: queries / segments / runs all depend only on params.id ──
  // The original code awaited them strictly in series. They are independent
  // reads on different tables — Promise.all collapses 3 round-trips into 1.
  // Profile fetch (for bot plan gating) is folded in to keep this one round-trip.
  const [queriesRes, segmentsRes, allRunsRawRes, profileRes] = await Promise.all([
    supabase
      .from("queries")
      .select("*")
      .eq("project_id", params.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", params.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("analysis_runs")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single(),
  ]);
  const queries = (queriesRes as any).data;
  const segments = (segmentsRes as any).data;
  const allRunsRaw = (allRunsRawRes as any).data;
  const userPlan = getEffectivePlanId(((profileRes as any).data as { plan?: string } | null)?.plan);

  const allRuns = (allRunsRaw ?? []).filter((r: any) => !r.deleted_at);
  const archivedRuns = (allRunsRaw ?? []).filter((r: any) => r.deleted_at);
  const lastRun = allRuns[0] ?? null;
  const activeRunIds = allRuns.map((r: any) => r.id);

  // ── Phase 3: AVI history. Original code issued TWO queries on this table
  // (one for the latest score, one for the full trend). They read from the
  // same row set — fetch ascending once, and pick the latest in JS. ──
  const { data: aviHistory } = activeRunIds.length > 0
    ? await supabase
        .from("avi_history")
        .select("*")
        .eq("project_id", params.id)
        .in("run_id", activeRunIds)
        .order("computed_at", { ascending: true })
    : { data: [] as any[] };

  const aviList = (aviHistory ?? []) as any[];
  const lastAvi = aviList.length > 0 ? aviList[aviList.length - 1] : null;
  const aviMap = new Map(aviList.map((a: any) => [a.run_id, a.avi_score]));

  // Get all unique models across runs
  const allModels = Array.from(new Set(allRuns.flatMap((r: any) => r.models_used ?? []))) as string[];

  // Build trend data for chart. Attach `models_used` from the matching run so
  // the tooltip can show which models were active when each AVI was computed —
  // post-edit context where the model set varies across runs.
  const runsById = new Map(allRuns.map((r: any) => [r.id, r]));
  const trendData = aviList.map((a: any, i: number) => {
    const run = runsById.get(a.run_id) as any | undefined;
    return {
      version: `v${i + 1}`,
      avi: Math.round(a.avi_score * 10) / 10,
      presence: Math.round(a.presence_score),
      sentiment: Math.round(a.sentiment_score),
      computed_at: a.computed_at,
      models_used: (run?.models_used ?? []) as string[],
    };
  });

  const tofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "tofu");
  const mofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "mofu");

  const proj = project as any;

  // ── Models awareness banners (additions + soft-skip) ─────────────────────
  // currentModels: what the project is configured to run
  // newModels:     models the user could ADD given their plan (max 3 shown)
  // lockedProModels: models in the project that the current plan can no longer use
  //                  (typically after a Pro→Base downgrade) — soft-skipped at run-time
  const currentModels: string[] = (proj.models_config as string[]) ?? [];
  const isProPlan = userPlan === "pro" || userPlan === "enterprise";
  const isDemoPlan = userPlan === "demo";
  const modelCap = isProPlan ? 5 : 3;

  const allSelectableModels = PROVIDER_GROUPS.flatMap((g) =>
    g.comingSoon ? [] : g.models.map((m) => ({ id: m.id, label: m.label, proOnly: !!m.proOnly }))
  );
  const newModels = allSelectableModels.filter((m) => {
    if (currentModels.includes(m.id)) return false;
    if (m.proOnly && !isProPlan) return false;
    return true;
  });
  const canAddMore = !isDemoPlan && currentModels.length < modelCap && newModels.length > 0;

  const lockedProModels = !isProPlan
    ? currentModels.filter((id) => PRO_ONLY_MODEL_IDS.has(id))
    : [];

  // ── Bot context: ownership is already enforced by the project query above
  // (.eq user_id). Plan + locale gate the actual mount inside <BotMount />.
  const cookieStore = cookies();
  const lang = normalizeLang(cookieStore.get("avi-locale")?.value);
  const botContext = buildProjectContext({
    plan: userPlan,
    lang,
    project: proj,
    lastAvi: lastAvi as any,
    lastRun: lastRun as any,
    totalRuns: allRuns.length,
    totalQueries: (queries ?? []).length,
  });

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <AutoLaunch />
      <div>
        <a
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <T k="projects.backToProjects" />
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
              <T k="projectDetail.editProject" />
            </a>
            <AnalysisLauncher
              projectId={params.id}
              hasQueries={(queries ?? []).length > 0}
              queryCount={(queries ?? []).length}
              segmentCount={(segments ?? []).length}
              modelsConfig={(proj.models_config as string[]) ?? ["gpt-5.4-mini"]}
              mofuCount={mofuQueries.length}
            />
          </div>
        </div>
      </div>

      {/* Project maturity / onboarding checklist — always visible */}
      <ProjectOnboardingChecklist
        projectId={params.id}
        queryCount={(queries ?? []).length}
        segmentCount={(segments ?? []).length}
        runsCount={allRuns.length}
      />

      {/* Modelli AI configurati */}
      <div className="flex items-center gap-2 flex-wrap">
        <Cpu className="w-3.5 h-3.5 text-cream-dim" />
        <span className="font-mono text-[13px] text-cream-dim"><T k="projectDetail.aiModels" /></span>
        {((proj.models_config as string[]) ?? ["gpt-5.4-mini"]).map((m: string) => {
          const isLockedPro = lockedProModels.includes(m);
          return (
            <span
              key={m}
              className={`badge text-[12px] ${isLockedPro ? "badge-muted text-amber-500 border-amber-500/30 bg-amber-500/10" : "badge-primary"}`}
              title={isLockedPro ? "Pro-only — escluso dalle prossime analisi finché non passi a Pro" : undefined}
            >
              {MODEL_MAP.get(m)?.label ?? m}
            </span>
          );
        })}
        {canAddMore && (
          <a
            href={`/projects/${params.id}/edit#models`}
            className="inline-flex items-center gap-1 text-[12px] font-mono text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded-[2px] transition-colors"
          >
            <Plus className="w-3 h-3" />
            Aggiungi modello
          </a>
        )}
      </div>

      {/* Banner: nuovi modelli disponibili nel piano */}
      {canAddMore && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-[3px] border border-primary/20 bg-primary/5">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="text-foreground">
              <span className="font-semibold">Modelli AI nuovi disponibili</span>
              {" — "}
              <span className="text-muted-foreground">{newModels.slice(0, 3).map((m) => m.label).join(", ")}{newModels.length > 3 ? ` +${newModels.length - 3}` : ""}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aggiungili al progetto per misurare la tua presenza anche su queste AI. Lo storico esistente non cambia.
            </p>
          </div>
          <a
            href={`/projects/${params.id}/edit#models`}
            className="text-xs font-medium text-primary hover:text-primary/80 whitespace-nowrap shrink-0"
          >
            Aggiungi →
          </a>
        </div>
      )}

      {/* Banner: modelli pro-only ereditati (soft skip) */}
      {lockedProModels.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-[3px] border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="text-foreground">
              <span className="font-semibold">Alcuni modelli richiedono il piano Pro</span>
              {" — "}
              <span className="text-muted-foreground">{lockedProModels.map((id) => MODEL_MAP.get(id)?.label ?? id).join(", ")}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Le prossime analisi useranno solo i modelli compatibili con il tuo piano. Lo storico precedente resta consultabile nei grafici.
            </p>
          </div>
          <a
            href="/piano"
            className="text-xs font-medium text-amber-500 hover:text-amber-400 whitespace-nowrap shrink-0"
          >
            Passa a Pro →
          </a>
        </div>
      )}

      {/* AVI Score + Last Run */}
      {lastAvi && (
        <div className="card p-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">AVI Score</p>
              <p className="font-display font-bold text-3xl text-primary">{(lastAvi as any).avi_score}</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1">
              {[
                { labelKey: "dashboard.presence", value: (lastAvi as any).presence_score },
                { labelKey: "dashboard.position", value: (lastAvi as any).rank_score },
                { labelKey: "dashboard.sentiment", value: (lastAvi as any).sentiment_score },
              ].map((c) => (
                <div key={c.labelKey} className="text-center">
                  <p className="text-xs text-muted-foreground"><T k={c.labelKey} /></p>
                  <p className="font-display font-semibold text-foreground">{Math.round(c.value || 0)}</p>
                </div>
              ))}
            </div>
          </div>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Ultima analisi: {new Date((lastRun as any).completed_at ?? (lastRun as any).created_at).toLocaleString("it-IT")}
              {" "}&middot; v{(lastRun as any).version}
              {" "}&middot; <span className="badge badge-success text-[12px]">{(lastRun as any).status}</span>
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
              <T k="projectDetail.failedAnalysis" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(lastRun as any).error_message
                ? (lastRun as any).error_message
                : (lastRun as any).completed_prompts === 0
                  ? <T k="projectDetail.failedBeforeStart" />
                  : `${(lastRun as any).completed_prompts}/${(lastRun as any).total_prompts} prompt`}
            </p>
          </div>
          <OpenAnalysisButton />
        </div>
      )}

      <div data-tour="project-queries" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query TOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Query TOFU</h2>
              <span className="badge badge-muted text-[12px]">{tofuQueries.length}</span>
            </div>
            <a href={`/projects/${params.id}/queries`} data-tour="add-query-btn" className="text-xs text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center"><T k="queries.noQueryTofu" /></p>
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
              <span className="badge badge-muted text-[12px]">{mofuQueries.length}</span>
            </div>
            <a href={`/projects/${params.id}/queries`} className="text-xs text-primary hover:text-primary/70 transition-colors">
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {mofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center"><T k="queries.noQueryMofu" /></p>
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
            <h2 className="font-display font-semibold text-foreground"><T k="projectDetail.activeSegments" /></h2>
            <span className="badge badge-muted text-[12px]">{(segments ?? []).length}</span>
          </div>
          <a href={`/projects/${params.id}/segments`} className="text-xs text-primary hover:text-primary/70 transition-colors"><T k="common.manage" /></a>
        </div>
        {!(segments ?? []).length ? (
          <p className="text-sm text-muted-foreground py-4 text-center"><T k="projectDetail.noActiveSegment" /></p>
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
        <div data-tour="run-results" className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground"><T k="projectDetail.executedAnalyses" /></h2>
            <span className="badge badge-muted text-[12px]">{allRuns.length}</span>
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
              const statusKey = run.status === "completed" ? "results.completed" : run.status === "running" ? "results.running" : run.status === "failed" ? "results.failed" : null;
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
                      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-[2px] border ${badgeClass}`}>
                        <Icon className={`w-3 h-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                        {statusKey ? <T k={statusKey} /> : run.status}
                      </span>
                    </div>
                  </a>
                  {run.status === "failed" && (
                    <p className="text-xs text-muted-foreground px-4">
                      {run.completed_prompts === 0
                        ? <T k="projectDetail.failedBeforeStart" />
                        : `${run.completed_prompts}/${run.total_prompts} prompt`}
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
            <T k="projectDetail.newQuery" />
          </a>
          <a
            href={`/projects/${params.id}/queries/generate`}
            data-tour="generate-queries-btn"
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <T k="settings.generatePromptAI" />
          </a>
          <a
            href={`/projects/${params.id}/segments`}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:border-primary/30 transition-colors"
          >
            <Users className="w-4 h-4" />
            <T k="projectDetail.segments" />
          </a>
        </div>
        <DeleteProjectButton projectId={params.id} projectName={proj.name} />
      </div>

      <BotMount plan={userPlan} context={botContext} />
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
        <span className={`font-mono text-[0.625rem] tracking-wide uppercase px-1 py-0.5 rounded-[2px] border shrink-0 mt-0.5 ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </li>
  );
}

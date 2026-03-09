import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Globe, Tag, Users, ExternalLink, Eye, Hash, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RunAVIRing } from "./run-avi-ring";
import { ExportButtons } from "./export-buttons";

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

  // Trend vs previous run
  let trend: number | null = null;
  if (avi) {
    const { data: allAvi } = await supabase
      .from("avi_history")
      .select("avi_score, computed_at")
      .eq("project_id", params.id)
      .order("computed_at", { ascending: false })
      .limit(2);
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

  // Fetch competitor AVI scores for this run
  const { data: competitorAvi } = await (supabase.from("competitor_avi") as any)
    .select("competitor_name, avi_score")
    .eq("run_id", params.runId);
  const compAviMap = new Map<string, number>((competitorAvi ?? []).map((c: any) => [c.competitor_name, c.avi_score as number]));

  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .eq("project_id", params.id)
    .eq("first_seen_run_id", params.runId);

  // Compute aggregate stats from analyses
  const analysesList = (analyses ?? []) as any[];
  const analysisMap = new Map(analysesList.map((a) => [a.prompt_executed_id, a]));
  const totalAnalysed = analysesList.length;
  const mentionCount = analysesList.filter((a) => a.brand_mentioned).length;
  const mentionRate = totalAnalysed > 0 ? Math.round((mentionCount / totalAnalysed) * 100) : 0;

  const ranked = analysesList.filter((a) => a.brand_rank !== null && a.brand_rank > 0);
  const avgRank = ranked.length > 0
    ? (ranked.reduce((s: number, a: any) => s + a.brand_rank, 0) / ranked.length).toFixed(1)
    : "—";

  const withSentiment = analysesList.filter((a) => a.sentiment_score !== null);
  const avgSentiment = withSentiment.length > 0
    ? (withSentiment.reduce((s: number, a: any) => s + a.sentiment_score, 0) / withSentiment.length).toFixed(2)
    : "—";

  const totalOccurrences = analysesList.reduce((s: number, a: any) => s + (a.brand_occurrences ?? 0), 0);

  // All competitors from all response_analysis rows (not just discovered)
  const allCompetitors = new Map<string, number>();
  analysesList.forEach((a) => {
    (a.competitors_found ?? []).forEach((c: string) => {
      allCompetitors.set(c, (allCompetitors.get(c) ?? 0) + 1);
    });
  });
  const competitorList = Array.from(allCompetitors.entries()).sort((a, b) => {
    const aviA = compAviMap.get(a[0]) ?? 0;
    const aviB = compAviMap.get(b[0]) ?? 0;
    return aviB - aviA || b[1] - a[1];
  });

  // All topics from analyses
  const allTopics = new Map<string, number>();
  analysesList.forEach((a) => {
    (a.topics ?? []).forEach((t: string) => {
      allTopics.set(t, (allTopics.get(t) ?? 0) + 1);
    });
  });
  const topicList = Array.from(allTopics.entries()).sort((a, b) => b[1] - a[1]);

  const statusInfo = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;
  const proj = project as any;
  const aviData = avi as any;

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
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

      {/* AVI Score: Ring + Component Bars */}
      {aviData && (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
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
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground">Componenti AVI</h2>
            <div className="space-y-3">
              {[
                { label: "Prominence", value: Math.round(aviData.presence_score ?? 0), color: "hsl(186, 100%, 50%)" },
                { label: "Rank", value: Math.round(aviData.rank_score ?? 0), color: "hsl(38, 95%, 58%)" },
                { label: "Sentiment", value: Math.round(aviData.sentiment_score ?? 0), color: "hsl(152, 68%, 46%)" },
                { label: "Consistency", value: Math.round(aviData.stability_score ?? 0), color: "hsl(270, 70%, 60%)" },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium text-foreground">{Math.round(c.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, c.value)}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Brand Mention Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <Eye className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{mentionRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Menzioni Brand</p>
          <p className="text-[10px] text-muted-foreground">{mentionCount}/{totalAnalysed} prompt</p>
        </div>
        <div className="card p-4 text-center">
          <Hash className="w-5 h-5 text-accent mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{totalOccurrences}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Occorrenze Totali</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{avgRank}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rank Medio</p>
          <p className="text-[10px] text-muted-foreground">{ranked.length} risposte con rank</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingDown className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="font-display font-bold text-2xl text-foreground">{avgSentiment}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sentiment Medio</p>
          <p className="text-[10px] text-muted-foreground">scala -1 / +1</p>
        </div>
      </div>

      {/* Competitors & Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Competitor Trovati</h2>
            <span className="badge badge-muted text-[10px]">{competitorList.length}</span>
          </div>
          {competitorList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun competitor individuato</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {competitorList.map(([name, count]) => {
                const cAvi = compAviMap.get(name);
                const aviColor = cAvi != null
                  ? cAvi >= 70 ? "text-success" : cAvi >= 40 ? "text-amber-500" : "text-destructive"
                  : "";
                return (
                  <span key={name} className="badge badge-primary flex items-center gap-1.5">
                    {name}
                    <span className="text-[9px] opacity-70">({count})</span>
                    {cAvi != null && (
                      <span className={`text-[10px] font-bold ${aviColor}`}>AVI {cAvi}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-accent" />
            <h2 className="font-display font-semibold text-foreground">Topic Emersi</h2>
            <span className="badge badge-muted text-[10px]">{topicList.length}</span>
          </div>
          {topicList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun topic individuato</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topicList.map(([name, count]) => {
                const size = count >= 5 ? "text-sm" : count >= 3 ? "text-xs" : "text-[10px]";
                const opacity = count >= 5 ? "opacity-100" : count >= 3 ? "opacity-80" : "opacity-60";
                return (
                  <span key={name} className={`badge badge-muted ${size} ${opacity}`}>
                    {name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      {(sources ?? []).length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Fonti Estratte</h2>
            <span className="badge badge-muted text-[10px]">{(sources ?? []).length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">URL / Dominio</th>
                  <th className="text-left py-2 pr-4 font-medium">Label</th>
                  <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                  <th className="text-left py-2 font-medium">Brand</th>
                </tr>
              </thead>
              <tbody>
                {(sources ?? []).map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">
                      {s.url ? (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[300px]">{s.url}</span>
                        </span>
                      ) : s.domain ?? "-"}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{s.label ?? "-"}</td>
                    <td className="py-2 pr-4"><span className="badge badge-muted text-[10px]">{s.source_type}</span></td>
                    <td className="py-2">{s.is_brand_owned ? <span className="badge badge-primary text-[10px]">Owned</span> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prompt results table */}
      {(prompts ?? []).length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-display font-semibold text-foreground">Prompt Eseguiti ({(prompts ?? []).length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Modello</th>
                  <th className="text-left py-2 pr-3 font-medium">Run</th>
                  <th className="text-left py-2 pr-3 font-medium">Brand</th>
                  <th className="text-left py-2 pr-3 font-medium">Rank</th>
                  <th className="text-left py-2 pr-3 font-medium">Sentiment</th>
                  <th className="text-left py-2 pr-3 font-medium">Competitors</th>
                  <th className="text-left py-2 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {(prompts ?? []).map((p: any, i: number) => {
                  const analysis = analysisMap.get(p.id) as any;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3"><span className="badge badge-muted text-[10px]">{p.model}</span></td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.run_number}</td>
                      <td className="py-2 pr-3">
                        {analysis ? (
                          analysis.brand_mentioned
                            ? <span className="text-success font-medium">Si</span>
                            : <span className="text-muted-foreground">No</span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2 pr-3 text-foreground">{analysis?.brand_rank ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {analysis?.sentiment_score != null ? (
                          <span className={analysis.sentiment_score > 0 ? "text-success" : analysis.sentiment_score < 0 ? "text-destructive" : "text-muted-foreground"}>
                            {analysis.sentiment_score > 0 ? "+" : ""}{analysis.sentiment_score.toFixed(2)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {analysis?.competitors_found?.length ? analysis.competitors_found.join(", ") : "-"}
                      </td>
                      <td className="py-2">
                        {p.error
                          ? <span className="badge badge-muted text-destructive text-[10px]">Errore</span>
                          : p.raw_response
                            ? <span className="badge badge-success text-[10px]">OK</span>
                            : <span className="badge badge-muted text-[10px]">Pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

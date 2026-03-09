import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { ModelSelector } from "@/components/model-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { Tag } from "lucide-react";

export const metadata = { title: "Topic" };

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  const targetProjects = selectedId
    ? projectsList.filter((p) => p.id === selectedId)
    : projectsList;

  const targetIds = targetProjects.map((p: any) => p.id);

  // Get runs to extract available models + filter
  const { data: allRuns } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, project_id, models_used").in("project_id", targetIds)
    : { data: [] };

  const modelsSet = new Set<string>();
  (allRuns ?? []).forEach((r: any) => (r.models_used ?? []).forEach((m: string) => modelsSet.add(m)));
  const availableModels = Array.from(modelsSet).sort();

  const selectedModel = searchParams.model || null;
  const filteredRunIds = (allRuns ?? [])
    .filter((r: any) => !selectedModel || (r.models_used ?? []).includes(selectedModel))
    .map((r: any) => r.id);

  // For each project, get topic counts from response_analysis (filtered by model)
  const projectTopics: { projectId: string; projectName: string; topics: [string, number][] }[] = [];
  const globalCounts = new Map<string, number>();

  for (const proj of targetProjects) {
    const projRunIds = filteredRunIds.length > 0
      ? filteredRunIds.filter((rid: string) => (allRuns ?? []).find((r: any) => r.id === rid && r.project_id === proj.id))
      : [];
    if (projRunIds.length === 0) continue;

    const { data: prompts } = await supabase
      .from("prompts_executed")
      .select("id")
      .in("run_id", projRunIds);

    const promptIds = (prompts ?? []).map((p: any) => p.id);
    if (promptIds.length === 0) continue;

    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("topics")
      .in("prompt_executed_id", promptIds);

    const counts = new Map<string, number>();
    (analyses ?? []).forEach((a: any) => {
      (a.topics ?? []).forEach((t: string) => {
        counts.set(t, (counts.get(t) ?? 0) + 1);
        globalCounts.set(t, (globalCounts.get(t) ?? 0) + 1);
      });
    });

    if (counts.size > 0) {
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      projectTopics.push({ projectId: proj.id, projectName: proj.name, topics: sorted });
    }
  }

  const globalList = Array.from(globalCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = globalList.length > 0 ? globalList[0][1] : 1;
  const top5 = new Set(globalList.slice(0, 5).map(([name]) => name));

  function getCloudSize(count: number): string {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return "text-3xl font-bold";
    if (ratio >= 0.5) return "text-2xl font-semibold";
    if (ratio >= 0.3) return "text-xl font-medium";
    if (ratio >= 0.15) return "text-base";
    return "text-sm";
  }

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-accent" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Topic</h1>
            <p className="text-sm text-muted-foreground">Argomenti emersi dalle risposte AI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector models={availableModels} />
          <ProjectSelector projects={projectsList.map((p) => ({ id: p.id, name: p.name }))} />
        </div>
      </div>

      {globalList.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessun topic trovato. Lancia un&apos;analisi per scoprirli.</p>
        </div>
      ) : (
        <>
          {/* Global Tag Cloud */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-foreground mb-4">Tag Cloud</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-baseline justify-center py-4">
              {globalList.map(([name, count]) => (
                <span
                  key={name}
                  className={`${getCloudSize(count)} ${top5.has(name) ? "text-primary" : "text-muted-foreground"} transition-opacity hover:opacity-100 cursor-default`}
                  title={`${count} menzioni`}
                >
                  {name}
                  <sup className="text-[10px] ml-0.5 opacity-60">{count}</sup>
                </span>
              ))}
            </div>
          </div>

          {/* Per-project sections */}
          {projectTopics.map((pt) => {
            const projMax = pt.topics[0]?.[1] ?? 1;
            return (
              <div key={pt.projectId} className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <h2 className="font-display font-semibold text-foreground">{pt.projectName}</h2>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {pt.topics.map(([name, count]) => (
                      <span
                        key={name}
                        className={`badge ${top5.has(name) ? "badge-primary" : "badge-muted"} flex items-center gap-1`}
                      >
                        {name}
                        <span className="text-[10px] opacity-70">({count})</span>
                      </span>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {pt.topics.slice(0, 10).map(([name, count]) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-40 truncate">{name}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${top5.has(name) ? "bg-primary" : "bg-muted-foreground/40"}`}
                            style={{ width: `${(count / projMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

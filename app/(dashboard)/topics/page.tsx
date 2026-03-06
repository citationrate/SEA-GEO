import { createServerClient } from "@/lib/supabase/server";
import { Tag } from "lucide-react";

export const metadata = { title: "Topic" };

export default async function TopicsPage({ searchParams }: { searchParams: { project?: string } }) {
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
  const filterProject = searchParams.project;
  const activeProjectIds = filterProject ? [filterProject] : projectIds;

  // Get runs for filtered projects
  const { data: runs } = activeProjectIds.length > 0
    ? await supabase.from("analysis_runs").select("id").in("project_id", activeProjectIds)
    : { data: [] };

  const runIds = (runs ?? []).map((r: any) => r.id);

  const { data: prompts } = runIds.length > 0
    ? await supabase.from("prompts_executed").select("id").in("run_id", runIds)
    : { data: [] };

  const promptIds = (prompts ?? []).map((p: any) => p.id);

  // Count topic occurrences from response_analysis
  const topicCounts = new Map<string, number>();

  if (promptIds.length > 0) {
    const { data: analyses } = await supabase
      .from("response_analysis")
      .select("topics")
      .in("prompt_executed_id", promptIds);

    (analyses ?? []).forEach((a: any) => {
      (a.topics ?? []).forEach((t: string) => {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      });
    });
  }

  const topicList = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = topicList.length > 0 ? topicList[0][1] : 1;

  function getCloudSize(count: number): string {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return "text-2xl font-bold";
    if (ratio >= 0.5) return "text-xl font-semibold";
    if (ratio >= 0.3) return "text-base font-medium";
    if (ratio >= 0.15) return "text-sm";
    return "text-xs";
  }

  function getCloudOpacity(count: number): string {
    const ratio = count / maxCount;
    if (ratio >= 0.5) return "opacity-100";
    if (ratio >= 0.25) return "opacity-80";
    return "opacity-60";
  }

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-accent" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Topic</h1>
            <p className="text-sm text-muted-foreground">Argomenti emersi dalle risposte AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/topics"
            className={`badge ${!filterProject ? "badge-primary" : "badge-muted"} text-xs`}
          >
            Tutti
          </a>
          {projectsList.map((p) => (
            <a
              key={p.id}
              href={`/topics?project=${p.id}`}
              className={`badge ${filterProject === p.id ? "badge-primary" : "badge-muted"} text-xs`}
            >
              {p.name}
            </a>
          ))}
        </div>
      </div>

      {topicList.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessun topic trovato. Lancia un&apos;analisi per scoprirli.</p>
        </div>
      ) : (
        <>
          {/* Tag Cloud */}
          <div className="card p-6">
            <h2 className="font-display font-semibold text-foreground mb-4">Tag Cloud</h2>
            <div className="flex flex-wrap gap-3 items-center justify-center py-4">
              {topicList.map(([name, count]) => (
                <span
                  key={name}
                  className={`text-primary ${getCloudSize(count)} ${getCloudOpacity(count)} transition-opacity hover:opacity-100 cursor-default`}
                  title={`${count} menzioni`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Topic List */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Topic</th>
                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Menzioni</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Frequenza</th>
                  </tr>
                </thead>
                <tbody>
                  {topicList.map(([name, count]) => (
                    <tr key={name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-display font-semibold text-foreground">{count}</span>
                      </td>
                      <td className="py-3 px-4 w-1/3">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              {topicList.length} topic trovati
            </div>
          </div>
        </>
      )}
    </div>
  );
}

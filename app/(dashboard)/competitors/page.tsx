import { createServerClient } from "@/lib/supabase/server";
import { Users, Trophy } from "lucide-react";

export const metadata = { title: "Competitor" };

export default async function CompetitorsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id);

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p.name]));

  const { data: competitors } = projectIds.length > 0
    ? await supabase
        .from("competitors")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Count occurrences per competitor name + project
  const compList = (competitors ?? []) as any[];

  // Also count how many times each competitor appears in response_analysis
  const runIds: string[] = [];
  if (projectIds.length > 0) {
    const { data: runs } = await supabase
      .from("analysis_runs")
      .select("id")
      .in("project_id", projectIds);
    (runs ?? []).forEach((r: any) => runIds.push(r.id));
  }

  let mentionCounts = new Map<string, number>();
  if (runIds.length > 0) {
    const { data: prompts } = await supabase
      .from("prompts_executed")
      .select("id")
      .in("run_id", runIds);
    const promptIds = (prompts ?? []).map((p: any) => p.id);

    if (promptIds.length > 0) {
      const { data: analyses } = await supabase
        .from("response_analysis")
        .select("competitors_found")
        .in("prompt_executed_id", promptIds);

      (analyses ?? []).forEach((a: any) => {
        (a.competitors_found ?? []).forEach((name: string) => {
          mentionCounts.set(name, (mentionCounts.get(name) ?? 0) + 1);
        });
      });
    }
  }

  // Build table rows: group by name, aggregate
  const grouped = new Map<string, { name: string; projects: Set<string>; mentions: number; firstSeen: string }>();
  for (const c of compList) {
    const existing = grouped.get(c.name);
    if (existing) {
      existing.projects.add(c.project_id);
      if (c.created_at < existing.firstSeen) existing.firstSeen = c.created_at;
    } else {
      grouped.set(c.name, {
        name: c.name,
        projects: new Set([c.project_id]),
        mentions: mentionCounts.get(c.name) ?? 0,
        firstSeen: c.created_at,
      });
    }
  }

  // Also include competitors found in analyses but not in competitors table
  for (const [name, count] of Array.from(mentionCounts.entries())) {
    if (!grouped.has(name)) {
      grouped.set(name, { name, projects: new Set(), mentions: count, firstSeen: "" });
    } else {
      grouped.get(name)!.mentions = count;
    }
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.mentions - a.mentions);

  const BADGE_COLORS = [
    "badge-primary", "badge-success", "badge-muted",
  ];

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Competitor</h1>
          <p className="text-sm text-muted-foreground">Tutti i competitor individuati nelle analisi AI</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nessun competitor trovato. Lancia un&apos;analisi per scoprirli.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Competitor</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Progetto</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Menzioni</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Prima volta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`badge ${BADGE_COLORS[i % BADGE_COLORS.length]}`}>{row.name}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {Array.from(row.projects).map((pid) => projectMap.get(pid) ?? "—").join(", ") || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-display font-semibold text-foreground">{row.mentions}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {row.firstSeen ? new Date(row.firstSeen).toLocaleDateString("it-IT") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

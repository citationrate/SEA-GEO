import { createServiceClient } from "@/lib/supabase/service";
import { Trophy, Search } from "lucide-react";

export const metadata = { title: "Competitor" };

export default async function AdminCompetitorPage() {
  const svc = createServiceClient();

  const { data: mentions } = await (svc.from("competitor_mentions") as any).select("competitor_name, competitor_type, project_id").limit(10000);
  const mentionList = (mentions ?? []) as any[];

  // Aggregate
  const compMap = new Map<string, { count: number; type: string; projects: Set<string> }>();
  for (const m of mentionList) {
    const key = (m.competitor_name as string).toLowerCase().trim();
    const existing = compMap.get(key);
    if (existing) {
      existing.count++;
      existing.projects.add(m.project_id);
    } else {
      compMap.set(key, { count: 1, type: m.competitor_type ?? "direct", projects: new Set([m.project_id]) });
    }
  }

  const rows = Array.from(compMap.entries())
    .map(([name, data]) => ({ name, count: data.count, type: data.type, projects: data.projects.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-primary" />
        <h1 className="font-display font-bold text-2xl text-foreground">Competitor Globali ({compMap.size})</h1>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">#</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Citazioni</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 text-foreground font-medium">{r.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.type}</td>
                <td className="px-4 py-3 font-bold text-foreground">{r.count}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.projects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

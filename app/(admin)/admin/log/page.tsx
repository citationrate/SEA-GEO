import { createServiceClient } from "@/lib/supabase/service";
import { ScrollText, CheckCircle, XCircle, Clock, Loader2, Play } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log Attivit\u00e0" };

export default async function AdminLogPage() {
  const svc = createServiceClient();

  // Recent analysis runs as activity log
  const { data: runs } = await svc.from("analysis_runs").select("*").order("created_at", { ascending: false }).limit(50);
  const projectIds = Array.from(new Set((runs ?? []).map((r: any) => r.project_id)));
  const { data: projects } = projectIds.length > 0 ? await svc.from("projects").select("id, name, user_id").in("id", projectIds) : { data: [] };
  const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
  const userIds = Array.from(new Set((projects ?? []).map((p: any) => p.user_id)));
  const { data: profiles } = userIds.length > 0 ? await svc.from("profiles").select("id, email, full_name").in("id", userIds) : { data: [] };
  const userMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Recent competitive analyses
  const { data: comparisons } = await (svc.from("competitive_analyses") as any).select("id, brand_a, brand_b, status, created_at, project_id").order("created_at", { ascending: false }).limit(20);

  const STATUS: Record<string, { icon: any; cls: string }> = {
    completed: { icon: CheckCircle, cls: "text-primary" },
    running: { icon: Loader2, cls: "text-yellow-500" },
    failed: { icon: XCircle, cls: "text-destructive" },
    pending: { icon: Clock, cls: "text-muted-foreground" },
  };

  // Merge into timeline
  type LogEntry = { type: string; label: string; detail: string; status: string; user: string; date: string };
  const entries: LogEntry[] = [];

  for (const r of (runs ?? []) as any[]) {
    const proj = projMap.get(r.project_id);
    const usr = proj ? userMap.get(proj.user_id) : null;
    entries.push({
      type: "analysis",
      label: `Analisi v${r.version}`,
      detail: proj?.name ?? "—",
      status: r.status,
      user: usr?.email ?? "—",
      date: r.created_at,
    });
  }

  for (const c of (comparisons ?? []) as any[]) {
    const proj = projMap.get(c.project_id);
    const usr = proj ? userMap.get(proj.user_id) : null;
    entries.push({
      type: "comparison",
      label: `Confronto ${c.brand_a} vs ${c.brand_b}`,
      detail: proj?.name ?? "—",
      status: c.status,
      user: usr?.email ?? "—",
      date: c.created_at,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-primary" />
        <h1 className="font-display font-bold text-2xl text-foreground">Log Attivit&agrave;</h1>
      </div>

      <div className="card p-5">
        <div className="space-y-1">
          {entries.slice(0, 50).map((e, i) => {
            const cfg = STATUS[e.status] ?? STATUS.pending;
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-[2px] hover:bg-muted/20 transition-colors">
                <Icon className={`w-4 h-4 shrink-0 ${cfg.cls}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground font-medium">{e.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{e.detail}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{e.user}</span>
                <span className="text-xs text-muted-foreground shrink-0 w-32 text-right">{new Date(e.date).toLocaleString("it-IT")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { createServiceClient } from "@/lib/supabase/service";
import { Swords, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confronti AI" };

export default async function AdminConfrontiPage() {
  const svc = createServiceClient();

  const { data: analyses } = await (svc.from("competitive_analyses") as any).select("*").order("created_at", { ascending: false }).limit(100);
  const projectIds = Array.from(new Set((analyses ?? []).map((a: any) => a.project_id)));
  const { data: projects } = projectIds.length > 0 ? await svc.from("projects").select("id, name, user_id").in("id", projectIds) : { data: [] };
  const projMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
  const userIds = Array.from(new Set((projects ?? []).map((p: any) => p.user_id)));
  const { data: profiles } = userIds.length > 0 ? await svc.from("profiles").select("id, email").in("id", userIds) : { data: [] };
  const emailMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));

  const STATUS: Record<string, { icon: any; cls: string }> = {
    completed: { icon: CheckCircle, cls: "text-primary" },
    running: { icon: Loader2, cls: "text-yellow-500" },
    failed: { icon: XCircle, cls: "text-destructive" },
    pending: { icon: Clock, cls: "text-muted-foreground" },
  };

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Swords className="w-6 h-6 text-primary" />
        <h1 className="font-display font-bold text-2xl text-foreground">Confronti AI ({(analyses ?? []).length})</h1>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Confronto</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Driver</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Utente</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Comp Score</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Stato</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Data</th>
            </tr>
          </thead>
          <tbody>
            {(analyses ?? []).map((a: any) => {
              const cfg = STATUS[a.status] ?? STATUS.pending;
              const Icon = cfg.icon;
              const proj = projMap.get(a.project_id);
              const email = proj ? emailMap.get(proj.user_id) : "—";
              return (
                <tr key={a.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{a.brand_a} vs {a.brand_b}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.driver}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{email}</td>
                  <td className="px-4 py-3">{a.comp_score_a != null ? <span className="font-bold text-primary">{Math.round(Number(a.comp_score_a))}</span> : "—"}</td>
                  <td className="px-4 py-3"><Icon className={`w-4 h-4 ${cfg.cls}`} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("it-IT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

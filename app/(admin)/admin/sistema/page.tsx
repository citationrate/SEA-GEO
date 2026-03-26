import { createServiceClient } from "@/lib/supabase/service";
import { Server, CheckCircle, AlertTriangle, Database, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sistema" };

export default async function AdminSystemPage() {
  const svc = createServiceClient();

  // DB health check
  const dbStart = Date.now();
  const { error: dbErr } = await svc.from("profiles").select("id").limit(1);
  const dbLatency = Date.now() - dbStart;
  const dbOk = !dbErr;

  // Count tables
  const [
    { count: profilesCount },
    { count: projectsCount },
    { count: runsCount },
    { count: promptsCount },
    { count: sourcesCount },
  ] = await Promise.all([
    svc.from("profiles").select("*", { count: "exact", head: true }),
    svc.from("projects").select("*", { count: "exact", head: true }),
    svc.from("analysis_runs").select("*", { count: "exact", head: true }),
    svc.from("prompts_executed").select("*", { count: "exact", head: true }),
    svc.from("sources").select("*", { count: "exact", head: true }),
  ]);

  // Recent errors
  const { data: failedRuns } = await svc.from("analysis_runs").select("id, created_at, project_id").eq("status", "failed").order("created_at", { ascending: false }).limit(5);

  const checks = [
    { label: "Supabase DB", ok: dbOk, detail: dbOk ? `${dbLatency}ms latenza` : `Errore: ${dbErr?.message}` },
    { label: "Anthropic API", ok: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? "Configurata" : "Mancante" },
    { label: "OpenAI API", ok: !!process.env.OPENAI_API_KEY, detail: process.env.OPENAI_API_KEY ? "Configurata" : "Mancante" },
    { label: "Google AI API", ok: !!process.env.GOOGLE_AI_API_KEY, detail: process.env.GOOGLE_AI_API_KEY ? "Configurata" : "Mancante" },
    { label: "Resend API", ok: !!process.env.RESEND_API_KEY, detail: process.env.RESEND_API_KEY ? "Configurata" : "Mancante" },
    { label: "Inngest", ok: !!process.env.INNGEST_EVENT_KEY, detail: process.env.INNGEST_EVENT_KEY ? "Configurata" : "Mancante" },
  ];

  const tables = [
    { name: "profiles", count: profilesCount ?? 0 },
    { name: "projects", count: projectsCount ?? 0 },
    { name: "analysis_runs", count: runsCount ?? 0 },
    { name: "prompts_executed", count: promptsCount ?? 0 },
    { name: "sources", count: sourcesCount ?? 0 },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Server className="w-6 h-6 text-primary" />
        <h1 className="font-display font-bold text-2xl text-foreground">Stato Sistema</h1>
      </div>

      {/* Health checks */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {checks.map((c) => (
          <div key={c.label} className="card p-4 flex items-center gap-3">
            {c.ok ? <CheckCircle className="w-5 h-5 text-primary shrink-0" /> : <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
            <div>
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table counts */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Database</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tables.map((t) => (
            <div key={t.name} className="bg-muted/20 rounded-[2px] p-3 text-center">
              <p className="font-display font-bold text-lg text-foreground">{t.count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-mono">{t.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent failures */}
      {(failedRuns ?? []).length > 0 && (
        <div className="card p-5 space-y-3 border-destructive/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Analisi fallite recenti</h2>
          </div>
          <div className="space-y-1">
            {(failedRuns ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{r.id.slice(0, 8)}</span>
                <span>{new Date(r.created_at).toLocaleString("it-IT")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

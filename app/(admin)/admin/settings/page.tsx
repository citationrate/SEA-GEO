import { Server, Shield } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings Admin" };

export default function AdminSettingsPage() {
  const envVars = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", set: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "SUPABASE_SERVICE_ROLE_KEY", set: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "ANTHROPIC_API_KEY", set: !!process.env.ANTHROPIC_API_KEY },
    { key: "OPENAI_API_KEY", set: !!process.env.OPENAI_API_KEY },
    { key: "GOOGLE_AI_API_KEY", set: !!process.env.GOOGLE_AI_API_KEY },
    { key: "PERPLEXITY_API_KEY", set: !!process.env.PERPLEXITY_API_KEY },
    { key: "XAI_API_KEY", set: !!process.env.XAI_API_KEY },
    { key: "RESEND_API_KEY", set: !!process.env.RESEND_API_KEY },
    { key: "INNGEST_EVENT_KEY", set: !!process.env.INNGEST_EVENT_KEY },
    { key: "INNGEST_SIGNING_KEY", set: !!process.env.INNGEST_SIGNING_KEY },
    { key: "CONSULTATION_EMAIL", set: !!process.env.CONSULTATION_EMAIL },
  ];

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="font-display font-bold text-2xl text-foreground">Impostazioni Admin</h1>
      </div>

      {/* Environment variables */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" /> Variabili d&apos;ambiente
        </h2>
        <div className="space-y-1">
          {envVars.map((v) => (
            <div key={v.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="font-mono text-xs text-foreground">{v.key}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-[2px] ${v.set ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"}`}>
                {v.set ? "Configurata" : "Mancante"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Link utili</h2>
        <div className="space-y-2 text-sm">
          <a href="/dashboard" className="text-primary hover:text-primary/80 transition-colors block">Torna alla Dashboard utente &rarr;</a>
          <a href="/settings" className="text-primary hover:text-primary/80 transition-colors block">Impostazioni utente &rarr;</a>
        </div>
      </div>
    </div>
  );
}

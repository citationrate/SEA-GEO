import { createServerClient } from "@/lib/supabase/server";
import { AI_MODELS, PROVIDER_CONFIG } from "@/lib/engine/models";
import { Settings, Cpu, Trash2, PlayCircle } from "lucide-react";
import { RestartTourButton } from "./restart-tour-button";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Impostazioni" };

// Deduplicate models by id (keep first occurrence)
const UNIQUE_MODELS = AI_MODELS.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;

  const modelsByProvider = new Map<string, typeof UNIQUE_MODELS>();
  for (const m of UNIQUE_MODELS) {
    const list = modelsByProvider.get(m.provider) ?? [];
    list.push(m);
    modelsByProvider.set(m.provider, list);
  }

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">Gestisci profilo, modelli e preferenze</p>
        </div>
      </div>

      {/* Client-side interactive sections */}
      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        fullName={p.full_name ?? ""}
        plan={p.plan ?? "free"}
        notifyAnalysisComplete={p.notify_analysis_complete ?? true}
      />

      {/* Modelli AI disponibili (read-only reference) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Tutti i Modelli AI</h2>
        </div>
        <div className="space-y-4">
          {Array.from(modelsByProvider.entries()).map(([provider, models]) => {
            const config = PROVIDER_CONFIG[provider];
            return (
              <div key={provider}>
                <p className={`text-sm font-semibold mb-2 ${config?.color ?? "text-foreground"}`}>{config?.label ?? provider}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {models.map((m) => {
                    const isSoon = m.id === "copilot-gpt4";
                    return (
                      <div key={m.id} className={`flex items-start gap-2 bg-muted/20 rounded-[2px] px-3 py-2 ${isSoon ? "opacity-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground">{m.label}</span>
                          {isSoon && <span className="font-mono text-[0.625rem] tracking-wide text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 rounded-[2px] ml-1.5">SOON</span>}
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tour guidato */}
      <div data-tour="settings-tour" className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Tour guidato</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <p className="text-sm text-muted-foreground">Rivedi il tour introduttivo di SeaGeo</p>
          <RestartTourButton />
        </div>
      </div>

      {/* Progetti eliminati */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-foreground">Progetti eliminati</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <p className="text-sm text-muted-foreground">Ripristina progetti che sono stati eliminati</p>
          <a
            href="/settings/deleted-projects"
            className="px-4 py-2 bg-muted/30 border border-[rgba(255,255,255,0.1)] text-foreground rounded-[2px] text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Gestisci
          </a>
        </div>
      </div>
    </div>
  );
}

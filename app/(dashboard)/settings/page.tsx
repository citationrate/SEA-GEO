import { createServerClient } from "@/lib/supabase/server";
import { AI_MODELS, PROVIDER_CONFIG } from "@/lib/engine/models";
import { SettingsClient } from "./settings-client";
import { SettingsHeader, AIModelsSection, TourSection, DeletedProjectsSection } from "./settings-sections";

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
      <SettingsHeader />

      {/* Client-side interactive sections */}
      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        fullName={p.full_name ?? ""}
        plan={p.plan ?? "free"}
        notifyAnalysisComplete={p.notify_analysis_complete ?? true}
      />

      {/* Modelli AI disponibili (read-only reference) */}
      <AIModelsSection>
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
      </AIModelsSection>

      <TourSection />
      <DeletedProjectsSection />
    </div>
  );
}

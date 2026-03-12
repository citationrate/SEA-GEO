import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";
import { resolveProjectId } from "@/lib/utils/resolve-project";
import { AI_MODELS, PROVIDER_CONFIG } from "@/lib/engine/models";
import { Settings, User, Globe, Cpu, CreditCard, Trash2, PlayCircle } from "lucide-react";
import { RestartTourButton } from "./restart-tour-button";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand, language")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);
  const selectedProject = projectsList.find((p: any) => p.id === selectedId) ?? projectsList[0];

  const modelsByProvider = new Map<string, typeof AI_MODELS>();
  for (const m of AI_MODELS) {
    const list = modelsByProvider.get(m.provider) ?? [];
    list.push(m);
    modelsByProvider.set(m.provider, list);
  }

  return (
    <div className="space-y-6 max-w-[900px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-accent" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Impostazioni</h1>
            <p className="text-sm text-muted-foreground">Gestisci profilo, progetto e preferenze</p>
          </div>
        </div>
        <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
      </div>

      {/* Profilo */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Profilo</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Email</label>
            <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{user.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">ID Utente</label>
            <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2 font-mono text-xs truncate">{user.id}</p>
          </div>
        </div>
      </div>

      {/* Progetto corrente */}
      {selectedProject && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Progetto corrente</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Nome progetto</label>
              <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{selectedProject.name}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Brand target</label>
              <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{selectedProject.target_brand}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Lingua</label>
              <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{selectedProject.language === "it" ? "Italiano" : "English"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modelli AI */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Modelli AI disponibili</h2>
        </div>
        <div className="space-y-4">
          {Array.from(modelsByProvider.entries()).map(([provider, models]) => {
            const config = PROVIDER_CONFIG[provider];
            return (
              <div key={provider}>
                <p className={`text-sm font-semibold mb-2 ${config?.color ?? "text-foreground"}`}>{config?.label ?? provider}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {models.map((m) => (
                    <label key={m.id} className="flex items-start gap-2 bg-muted/20 rounded-[2px] px-3 py-2 cursor-default">
                      <input type="checkbox" defaultChecked className="mt-1 accent-primary" disabled />
                      <div>
                        <span className="text-sm text-foreground">{m.label}</span>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tour guidato */}
      <div className="card p-6 space-y-4">
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

      {/* Abbonamento */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Abbonamento</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Piano Free</p>
            <p className="text-xs text-muted-foreground">Analisi limitate — upgrade per sbloccare tutto</p>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}

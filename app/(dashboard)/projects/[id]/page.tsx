import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Play, MessageSquare, Users } from "lucide-react";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  const { data: queries } = await supabase
    .from("queries")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const { data: segments } = await supabase
    .from("audience_segments")
    .select("*")
    .eq("project_id", params.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const tofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "tofu");
  const mofuQueries = (queries ?? []).filter((q: any) => q.funnel_stage === "mofu");

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div>
        <a
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai progetti
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">{(project as any).name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {(project as any).target_brand}
              {(project as any).country && <> &middot; {(project as any).country}</>}
              {" "}&middot; {((project as any).language as string).toUpperCase()}
            </p>
          </div>
          <a
            href={`/projects/${params.id}/queries`}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
          >
            <Play className="w-4 h-4" />
            Lancia Analisi
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query TOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Query TOFU</h2>
              <span className="badge badge-muted text-[10px]">{tofuQueries.length}</span>
            </div>
            <a
              href={`/projects/${params.id}/queries`}
              className="text-xs text-primary hover:text-primary/70 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {tofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessuna query TOFU</p>
          ) : (
            <ul className="space-y-2">
              {tofuQueries.map((q: any) => (
                <li key={q.id} className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 border border-border">
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Query MOFU */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h2 className="font-display font-semibold text-foreground">Query MOFU</h2>
              <span className="badge badge-muted text-[10px]">{mofuQueries.length}</span>
            </div>
            <a
              href={`/projects/${params.id}/queries`}
              className="text-xs text-primary hover:text-primary/70 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </a>
          </div>
          {mofuQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessuna query MOFU</p>
          ) : (
            <ul className="space-y-2">
              {mofuQueries.map((q: any) => (
                <li key={q.id} className="text-sm text-foreground bg-muted rounded-lg px-3 py-2 border border-border">
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Segmenti audience */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Segmenti Audience Attivi</h2>
            <span className="badge badge-muted text-[10px]">{(segments ?? []).length}</span>
          </div>
          <a
            href={`/projects/${params.id}/segments`}
            className="text-xs text-primary hover:text-primary/70 transition-colors flex items-center gap-1"
          >
            Gestisci
          </a>
        </div>
        {!(segments ?? []).length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nessun segmento attivo</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(segments ?? []).map((s: any) => (
              <div key={s.id} className="bg-muted rounded-lg px-3 py-2 border border-border">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.prompt_context}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Azioni */}
      <div className="flex gap-3">
        <a
          href={`/projects/${params.id}/queries`}
          className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:border-primary/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuova Query
        </a>
        <a
          href={`/projects/${params.id}/segments`}
          className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:border-primary/30 transition-colors"
        >
          <Users className="w-4 h-4" />
          Segmenti
        </a>
      </div>
    </div>
  );
}

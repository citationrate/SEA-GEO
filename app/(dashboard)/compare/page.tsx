import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GitCompare, Plus, Clock, CheckCircle, XCircle, Loader2, Swords, Lock } from "lucide-react";
import { isProUser } from "@/lib/utils/is-pro";

export const metadata = { title: "Confronto Competitivo" };

function scoreLabel(score: number | null): { text: string; cls: string } {
  if (score == null) return { text: "—", cls: "text-muted-foreground" };
  if (score >= 60) return { text: "Dominante", cls: "text-primary" };
  if (score >= 40) return { text: "Competitivo", cls: "text-[#c4a882]" };
  return { text: "Svantaggiato", cls: "text-destructive" };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { upgrade?: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isPro = isProUser(profile as any, user.user_metadata);

  // Paywall for non-Pro users
  if (!isPro) {
    return (
      <div className="space-y-6 max-w-[1200px] animate-fade-in">
        <div className="flex items-center gap-3">
          <GitCompare className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Confronto Competitivo</h1>
            <p className="text-sm text-muted-foreground">Analisi AI head-to-head tra brand</p>
          </div>
        </div>
        <div className="card p-16 text-center border border-dashed border-[#c4a882]/30 space-y-4">
          <Lock className="w-12 h-12 text-[#c4a882]/40 mx-auto" />
          <h2 className="font-display font-semibold text-xl text-foreground">
            Funzionalità Pro
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            L&apos;analisi competitiva AI confronta il tuo brand con un competitor specifico
            su driver chiave, misurando Win Rate, First Mention Rate e CompScore
            attraverso risposte multiple di diversi modelli AI.
          </p>
          <p className="text-muted-foreground text-sm">
            Questa funzionalità è disponibile solo nel piano Pro.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 bg-[#c4a882] text-background font-semibold text-sm px-6 py-2.5 rounded-[2px] hover:bg-[#c4a882]/85 transition-colors mt-2"
          >
            Upgrade a Pro
          </a>
        </div>
      </div>
    );
  }

  // Fetch all projects for reference
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p.name]));
  const projectIds = (projects ?? []).map((p: any) => p.id);

  // Fetch all competitive analyses
  const { data: analyses } = projectIds.length > 0
    ? await (supabase.from("competitive_analyses") as any)
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const list = (analyses ?? []) as any[];

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitCompare className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Confronto Competitivo</h1>
            <p className="text-sm text-muted-foreground">
              {list.length} analisi &middot; Confronta il tuo brand con i competitor
            </p>
          </div>
        </div>
        <a
          href="/compare/new"
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuova Analisi
        </a>
      </div>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nessuna analisi competitiva. Crea la prima per confrontare il tuo brand con un competitor.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Confronto</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Driver</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetto</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">CompScore</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Stato</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => {
                  const label = scoreLabel(a.comp_score_a);
                  const StatusIcon = a.status === "completed" ? CheckCircle
                    : a.status === "failed" ? XCircle
                    : a.status === "running" ? Loader2
                    : Clock;
                  const statusCls = a.status === "completed" ? "text-primary"
                    : a.status === "failed" ? "text-destructive"
                    : a.status === "running" ? "text-yellow-500 animate-spin"
                    : "text-muted-foreground";

                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`/compare/${a.id}`}
                          className="text-foreground font-medium hover:text-primary transition-colors"
                        >
                          {a.brand_a} vs {a.brand_b}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.driver}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {projectMap.get(a.project_id) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.comp_score_a != null ? (
                          <span className={`font-bold ${label.cls}`}>
                            {Math.round(a.comp_score_a)} — {label.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusIcon className={`w-4 h-4 ${statusCls}`} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("it-IT")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

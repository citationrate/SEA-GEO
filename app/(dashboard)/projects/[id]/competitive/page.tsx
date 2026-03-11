import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { CompetitiveForm } from "./competitive-form";

export default async function CompetitivePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  const proj = project as any;

  // Get top competitor by AVI for pre-fill suggestion
  const { data: topCompetitor } = await (supabase.from("competitor_avi") as any)
    .select("competitor_name, avi_score")
    .eq("project_id", params.id)
    .order("avi_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get past analyses
  const { data: analyses } = await (supabase.from("competitive_analyses") as any)
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href={`/projects/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al progetto
        </a>
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Analisi Competitiva</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Confronta {proj.target_brand} con un competitor specifico
            </p>
          </div>
        </div>
      </div>

      <CompetitiveForm
        projectId={params.id}
        brandA={proj.target_brand}
        suggestedCompetitor={topCompetitor?.competitor_name ?? ""}
        analyses={(analyses ?? []) as any[]}
      />
    </div>
  );
}

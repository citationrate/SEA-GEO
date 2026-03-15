import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft, GitCompare } from "lucide-react";
import { isProUser } from "@/lib/utils/is-pro";
import { PROVIDER_GROUPS, filterAvailableModels } from "@/lib/engine/models";
import { NewCompetitiveForm } from "./new-competitive-form";
import { T } from "@/components/translated-label";

export const metadata = { title: "Nuova Analisi Competitiva" };

export default async function NewCompetitivePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check Pro access
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!isProUser(profile as any, user.user_metadata)) redirect("/compare?upgrade=1");

  // Get user projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];

  // Get top competitor per project for pre-fill
  const topCompetitors: Record<string, string> = {};
  for (const p of projectsList) {
    const { data: top } = await (supabase.from("competitor_avi") as any)
      .select("competitor_name")
      .eq("project_id", p.id)
      .order("avi_score", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (top?.competitor_name) topCompetitors[p.id] = top.competitor_name;
  }

  // Build available provider groups filtering by env availability
  const allModelIds = PROVIDER_GROUPS.flatMap((g) => g.models.map((m) => m.id));
  const availableIds = new Set(filterAvailableModels(allModelIds));

  const availableGroups = PROVIDER_GROUPS
    .filter((g) => !g.comingSoon)
    .map((g) => ({
      id: g.id,
      label: g.label,
      badge: g.badge,
      color: g.color,
      models: g.models
        .filter((m) => availableIds.has(m.id))
        .map((m) => ({ id: m.id, label: m.label, descriptionKey: m.descriptionKey })),
    }))
    .filter((g) => g.models.length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <a
          href="/compare"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <T k="nav.backToComparison" />
        </a>
        <div className="flex items-center gap-3">
          <GitCompare className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground"><T k="compare.newCompetitiveTitle" /></h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <T k="compare.newCompetitiveSubtitle" />
            </p>
          </div>
        </div>
      </div>

      <NewCompetitiveForm
        projects={projectsList.map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.target_brand,
        }))}
        topCompetitors={topCompetitors}
        providerGroups={availableGroups}
      />
    </div>
  );
}

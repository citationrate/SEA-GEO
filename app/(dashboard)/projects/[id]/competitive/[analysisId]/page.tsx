import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CompetitiveResults } from "./competitive-results";

export default async function CompetitiveResultsPage({
  params,
}: {
  params: { id: string; analysisId: string };
}) {
  const supabase = createServerClient();

  const { data: analysis } = await (supabase.from("competitive_analyses") as any)
    .select("*")
    .eq("id", params.analysisId)
    .single();

  if (!analysis) notFound();

  const { data: prompts } = await (supabase.from("competitive_prompts") as any)
    .select("*")
    .eq("analysis_id", params.analysisId)
    .order("pattern_type", { ascending: true })
    .order("model", { ascending: true })
    .order("run_number", { ascending: true });

  return (
    <CompetitiveResults
      analysis={analysis}
      prompts={(prompts ?? []) as any[]}
      projectId={params.id}
    />
  );
}

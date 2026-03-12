import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { CompetitiveResults } from "./competitive-results";

export default async function CompetitiveResultsPage({
  params,
}: {
  params: { analysisId: string };
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  // Fetch historical analyses for the same brand pair + driver (for trend chart)
  const { data: historicalAnalyses } = await (supabase.from("competitive_analyses") as any)
    .select("id, brand_a, brand_b, driver, win_rate_a, win_rate_b, fmr_a, fmr_b, comp_score_a, status, created_at, mode")
    .eq("brand_a", analysis.brand_a)
    .eq("brand_b", analysis.brand_b)
    .eq("driver", analysis.driver)
    .eq("status", "completed")
    .order("created_at", { ascending: true });

  return (
    <CompetitiveResults
      analysis={analysis}
      prompts={(prompts ?? []) as any[]}
      historicalAnalyses={(historicalAnalyses ?? []) as any[]}
      currentAnalysisId={params.analysisId}
    />
  );
}

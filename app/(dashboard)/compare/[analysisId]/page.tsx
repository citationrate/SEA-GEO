import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CompetitiveResults } from "./competitive-results";
import { BotMount } from "@/components/BotMount";
import { buildCompareContext, normalizeLang } from "@/lib/bot-context";
import { getEffectivePlanId } from "@/lib/utils/is-pro";

export default async function CompetitiveResultsPage({
  params,
}: {
  params: { analysisId: string };
}) {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createDataClient();
  const { data: analysis } = await (supabase.from("competitive_analyses") as any)
    .select("*")
    .eq("id", params.analysisId)
    .single();

  if (!analysis) notFound();

  // Bot ownership gate: competitive_analyses has a user_id column. The page
  // itself does not block non-owners (kept that way to avoid changing existing
  // behavior), but the bot is shown only to the analysis owner.
  const isOwner =
    typeof (analysis as { user_id?: unknown }).user_id === "string" &&
    (analysis as { user_id?: unknown }).user_id === user.id;

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

  // Normalize NUMERIC columns (Supabase returns NUMERIC as strings)
  const numOrNull = (v: any) => v != null ? Number(v) : null;
  const normalizedAnalysis = {
    ...analysis,
    win_rate_a: numOrNull(analysis.win_rate_a),
    win_rate_b: numOrNull(analysis.win_rate_b),
    fmr_a: numOrNull(analysis.fmr_a),
    fmr_b: numOrNull(analysis.fmr_b),
    comp_score_a: numOrNull(analysis.comp_score_a),
  };
  const normalizedPrompts = (prompts ?? []).map((p: any) => ({
    ...p,
    recommendation: numOrNull(p.recommendation),
  }));
  const normalizedHistory = (historicalAnalyses ?? []).map((h: any) => ({
    ...h,
    win_rate_a: numOrNull(h.win_rate_a),
    win_rate_b: numOrNull(h.win_rate_b),
    fmr_a: numOrNull(h.fmr_a),
    fmr_b: numOrNull(h.fmr_b),
    comp_score_a: numOrNull(h.comp_score_a),
  }));

  // Build bot context only for the owner.
  let botPlan: ReturnType<typeof getEffectivePlanId> = "demo";
  let botContext: ReturnType<typeof buildCompareContext> | null = null;
  if (isOwner) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    botPlan = getEffectivePlanId((profile as { plan?: string } | null)?.plan);
    const cookieStore = cookies();
    const lang = normalizeLang(cookieStore.get("avi-locale")?.value);
    botContext = buildCompareContext({
      plan: botPlan,
      lang,
      analysis: normalizedAnalysis as any,
    });
  }

  return (
    <>
      <CompetitiveResults
        analysis={normalizedAnalysis}
        prompts={normalizedPrompts as any[]}
        historicalAnalyses={normalizedHistory as any[]}
        currentAnalysisId={params.analysisId}
      />
      {botContext && <BotMount plan={botPlan} context={botContext} />}
    </>
  );
}

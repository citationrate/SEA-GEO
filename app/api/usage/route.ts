import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { getUserPlanLimits, getCurrentUsage } from "@/lib/usage";
import { getEffectivePlanId } from "@/lib/utils/is-pro";

export async function GET() {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {
    // Get profile plan
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("plan")
      .eq("id", user.id)
      .single();

    const planId = getEffectivePlanId((profile as any)?.plan);

    // Get plan limits and current usage
    const plan = await getUserPlanLimits(user.id);
    const usage = await getCurrentUsage(user.id);

    const effectiveBrowsingLimit = Number(plan.browsing_prompts || 0) + Number(usage.extraBrowsingPrompts || 0);
    const effectiveNoBrowsingLimit = Number(plan.no_browsing_prompts || 0) + Number(usage.extraNoBrowsingPrompts || 0);
    const effectiveComparisonsLimit = Number(plan.max_comparisons || 0) + Number(usage.extraComparisons || 0);

    const isDemo = planId === "demo";
    const isPro = planId === "pro";

    return NextResponse.json({
      planId,
      isDemo,
      isPro,
      browsingPromptsUsed: usage.browsingPromptsUsed,
      browsingPromptsLimit: effectiveBrowsingLimit,
      browsingPromptsRemaining: Math.max(0, effectiveBrowsingLimit - usage.browsingPromptsUsed),
      noBrowsingPromptsUsed: usage.noBrowsingPromptsUsed,
      noBrowsingPromptsLimit: effectiveNoBrowsingLimit,
      noBrowsingPromptsRemaining: Math.max(0, effectiveNoBrowsingLimit - usage.noBrowsingPromptsUsed),
      comparisonsUsed: usage.comparisonsUsed,
      comparisonsLimit: effectiveComparisonsLimit,
      comparisonsRemaining: Math.max(0, effectiveComparisonsLimit - usage.comparisonsUsed),
      extraBrowsingPrompts: usage.extraBrowsingPrompts,
      extraNoBrowsingPrompts: usage.extraNoBrowsingPrompts,
      extraComparisons: usage.extraComparisons,
      urlAnalysesUsed: usage.urlAnalysesUsed ?? 0,
      urlAnalysesLimit: isPro ? Number(plan.max_url_analyses || 50) : 0,
      urlAnalysesRemaining: isPro ? Math.max(0, Number(plan.max_url_analyses || 50) - (usage.urlAnalysesUsed ?? 0)) : 0,
      contextAnalysesUsed: usage.contextAnalysesUsed ?? 0,
      contextAnalysesLimit: isPro ? Number(plan.max_context_analyses || 5) : 0,
      contextAnalysesRemaining: isPro ? Math.max(0, Number(plan.max_context_analyses || 5) - (usage.contextAnalysesUsed ?? 0)) : 0,
      canGenerateQueries: plan.can_generate_queries ?? !isDemo,
      canAccessDataset: plan.can_access_dataset ?? false,
      canAccessComparisons: plan.can_access_comparisons ?? false,
      maxModelsPerProject: Number(plan.max_models_per_project || (isDemo ? 2 : isPro ? 5 : 3)),
    });
  } catch (err) {
    console.error("[/api/usage] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

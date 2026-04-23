import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { getUserPlanLimits, getCurrentUsage, getWallet } from "@/lib/usage";
import { getEffectivePlanId } from "@/lib/utils/is-pro";
import {
  resolvePlanLimit,
  isUnlimitedLimit,
  isProOrEnterprise,
} from "@/lib/plan-limits";

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

    // Get plan limits, current usage, and wallet
    const plan = await getUserPlanLimits(user.id);
    const usage = await getCurrentUsage(user.id);
    const wallet = await getWallet(user.id);

    // NULL in the plans table = unlimited (Enterprise). resolvePlanLimit
    // maps that to a large finite sentinel so arithmetic + JSON both work.
    const browsingBase = resolvePlanLimit((plan as any).browsing_prompts, 0);
    const noBrowsingBase = resolvePlanLimit((plan as any).no_browsing_prompts, 0);
    const comparisonsBase = resolvePlanLimit((plan as any).max_comparisons, 0);

    const browsingUnlimited = isUnlimitedLimit(browsingBase);
    const noBrowsingUnlimited = isUnlimitedLimit(noBrowsingBase);
    const comparisonsUnlimited = isUnlimitedLimit(comparisonsBase);

    // Don't stack "extra" on top of an unlimited base — it would overflow to
    // a visibly nonsense number in the UI without changing behavior.
    const effectiveBrowsingLimit = browsingUnlimited
      ? browsingBase
      : browsingBase + Number(usage.extraBrowsingPrompts || 0);
    const effectiveNoBrowsingLimit = noBrowsingUnlimited
      ? noBrowsingBase
      : noBrowsingBase + Number(usage.extraNoBrowsingPrompts || 0);
    const effectiveComparisonsLimit = comparisonsUnlimited
      ? comparisonsBase
      : comparisonsBase + Number(usage.extraComparisons || 0);

    const isDemo = planId === "demo";
    const isPro = planId === "pro";
    const isEnterprise = planId === "enterprise";
    const hasProFeatures = isProOrEnterprise(planId);

    // URL / context analyses are Pro+ features. Enterprise uses NULL in DB to
    // mean unlimited (context analyses Enterprise is capped at 100 explicitly).
    const urlAnalysesLimit = hasProFeatures
      ? resolvePlanLimit((plan as any).max_url_analyses, 50)
      : 0;
    const contextAnalysesLimit = hasProFeatures
      ? resolvePlanLimit((plan as any).max_context_analyses, 5)
      : 0;

    return NextResponse.json({
      planId,
      isDemo,
      isPro,
      isEnterprise,
      hasProFeatures,
      browsingPromptsUsed: usage.browsingPromptsUsed,
      browsingPromptsLimit: effectiveBrowsingLimit,
      browsingPromptsRemaining: Math.max(0, effectiveBrowsingLimit - usage.browsingPromptsUsed),
      browsingUnlimited,
      noBrowsingPromptsUsed: usage.noBrowsingPromptsUsed,
      noBrowsingPromptsLimit: effectiveNoBrowsingLimit,
      noBrowsingPromptsRemaining: Math.max(0, effectiveNoBrowsingLimit - usage.noBrowsingPromptsUsed),
      noBrowsingUnlimited,
      comparisonsUsed: usage.comparisonsUsed,
      comparisonsLimit: effectiveComparisonsLimit,
      comparisonsRemaining: Math.max(0, effectiveComparisonsLimit - usage.comparisonsUsed),
      comparisonsUnlimited,
      extraBrowsingPrompts: usage.extraBrowsingPrompts,
      extraNoBrowsingPrompts: usage.extraNoBrowsingPrompts,
      extraComparisons: usage.extraComparisons,
      urlAnalysesUsed: usage.urlAnalysesUsed ?? 0,
      urlAnalysesLimit,
      urlAnalysesRemaining: hasProFeatures
        ? Math.max(0, urlAnalysesLimit - (usage.urlAnalysesUsed ?? 0))
        : 0,
      urlAnalysesUnlimited: isUnlimitedLimit(urlAnalysesLimit),
      contextAnalysesUsed: usage.contextAnalysesUsed ?? 0,
      contextAnalysesLimit,
      contextAnalysesRemaining: hasProFeatures
        ? Math.max(0, contextAnalysesLimit - (usage.contextAnalysesUsed ?? 0))
        : 0,
      contextAnalysesUnlimited: isUnlimitedLimit(contextAnalysesLimit),
      canGenerateQueries: plan.can_generate_queries ?? !isDemo,
      canAccessDataset: plan.can_access_dataset ?? false,
      canAccessComparisons: plan.can_access_comparisons ?? false,
      maxModelsPerProject: Number(
        plan.max_models_per_project || (isDemo ? 2 : isEnterprise ? 10 : isPro ? 5 : 3),
      ),
      wallet: {
        browsingQueries: wallet.browsingQueries,
        noBrowsingQueries: wallet.noBrowsingQueries,
        confronti: wallet.confronti,
      },
    });
  } catch (err) {
    console.error("[/api/usage] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

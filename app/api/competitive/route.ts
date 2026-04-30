import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest";
import { COMPARISON_MODEL_IDS } from "@citationrate/llm-client";
import { getUserPlanLimits, getCurrentUsage, getWallet, consumeWalletConfronti, incrementComparisonsUsed, incrementNoBrowsingPromptsUsed } from "@/lib/usage";
import { resolvePlanLimit, isUnlimitedLimit } from "@/lib/plan-limits";

const startSchema = z.object({
  project_id: z.string().uuid(),
  brand_b: z.string().min(1),
  driver: z.string().min(1),
  models: z.array(z.string()).min(1).optional(),
  query_source: z.enum(["plan", "wallet"]).default("plan"),
});

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, brand_b, driver, models: requestedModels, query_source } = parsed.data;

    // Plan limits check
    const plan = await getUserPlanLimits(user.id);
    const usage = await getCurrentUsage(user.id);
    const wallet = await getWallet(user.id);

    if (query_source === "wallet") {
      // Wallet: check confronti credits
      if (wallet.confronti < 1) {
        return NextResponse.json({ error: "Nessun confronto disponibile nel wallet. Acquista un pacchetto confronti." }, { status: 403 });
      }
    } else {
      // Plan: check plan access + monthly limit
      if (!plan.can_access_comparisons) {
        return NextResponse.json({ error: "I confronti AI sono disponibili dal piano Pro." }, { status: 403 });
      }
      // NULL = unlimited (Enterprise). See lib/plan-limits.ts.
      const comparisonsBase = resolvePlanLimit((plan as any).max_comparisons, 0);
      const totalComparisonsAvailable = isUnlimitedLimit(comparisonsBase)
        ? comparisonsBase
        : comparisonsBase + Number(usage.extraComparisons || 0);
      if (usage.comparisonsUsed >= totalComparisonsAvailable) {
        return NextResponse.json({ error: `Hai raggiunto il limite di ${totalComparisonsAvailable} confronti mensili.` }, { status: 403 });
      }

      // Comparison prompts count against no_browsing_prompts_used
      const comparisonPromptCost = 3;
      const noBrowsingBase = resolvePlanLimit((plan as any).no_browsing_prompts, 0);
      const totalNoBrowsingAvailable = isUnlimitedLimit(noBrowsingBase)
        ? noBrowsingBase
        : noBrowsingBase + Number(usage.extraNoBrowsingPrompts || 0);
      if (usage.noBrowsingPromptsUsed + comparisonPromptCost > totalNoBrowsingAvailable) {
        return NextResponse.json({
          error: "Non hai abbastanza prompt senza browsing disponibili per questo confronto.",
        }, { status: 403 });
      }
    }

    // Get project brand
    const { data: project } = await supabase
      .from("projects")
      .select("target_brand, language")
      .eq("id", project_id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const brandA = (project as any).target_brand;
    const projectLanguage = (project as any).language ?? "it";

    // Filter to only allowed comparison models — always no-browsing
    const allowedSet = new Set<string>(COMPARISON_MODEL_IDS);
    const models = requestedModels
      ? requestedModels.filter((m) => allowedSet.has(m))
      : [...COMPARISON_MODEL_IDS];
    if (models.length === 0) {
      return NextResponse.json({ error: "At least one valid comparison model required" }, { status: 400 });
    }

    // Create analysis
    const { data: analysis, error } = await (supabase.from("competitive_analyses") as any)
      .insert({
        project_id,
        user_id: user.id,
        brand_a: brandA,
        brand_b,
        driver,
        mode: "light",
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger Inngest
    await inngest.send({
      name: "competitive/start",
      data: {
        analysisId: analysis.id,
        brandA,
        brandB: brand_b,
        driver,
        models,
        language: projectLanguage,
      },
    });

    // Consume from correct source
    if (query_source === "wallet") {
      await consumeWalletConfronti(user.id, 1).catch((err) =>
        console.error("[competitive] wallet confronti consume error:", err)
      );
    } else {
      await incrementComparisonsUsed(user.id).catch((err) =>
        console.error("[competitive] comparisons usage increment error:", err)
      );
      await incrementNoBrowsingPromptsUsed(user.id, 3).catch((err) =>
        console.error("[competitive] no-browsing usage increment error:", err)
      );
    }

    return NextResponse.json({ id: analysis.id }, { status: 201 });
  } catch (err) {
    console.error("[competitive/start] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

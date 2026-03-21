import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest";
import { COMPARISON_MODEL_IDS } from "@/lib/engine/models";
import { getUserPlanLimits, getCurrentUsage, incrementComparisonsUsed, incrementNoBrowsingPromptsUsed } from "@/lib/usage";

const startSchema = z.object({
  project_id: z.string().uuid(),
  brand_b: z.string().min(1),
  driver: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, brand_b, driver } = parsed.data;

    // Plan limits check
    const plan = await getUserPlanLimits(user.id);
    if (!plan.can_access_comparisons) {
      return NextResponse.json({ error: "I confronti AI sono disponibili dal piano Pro." }, { status: 403 });
    }
    const usage = await getCurrentUsage(user.id);
    if (usage.comparisonsUsed >= plan.max_comparisons) {
      return NextResponse.json({ error: `Hai raggiunto il limite di ${plan.max_comparisons} confronti mensili.` }, { status: 403 });
    }

    // Comparison prompts count against no_browsing_prompts_used
    // Typical comparison: 3 queries × 5 models × 3 runs = ~45 prompts, but cost = 3 queries
    const comparisonPromptCost = 3; // 3 default queries
    if (usage.noBrowsingPromptsUsed + comparisonPromptCost > Number(plan.no_browsing_prompts)) {
      return NextResponse.json({
        error: "Non hai abbastanza prompt senza browsing disponibili per questo confronto.",
      }, { status: 403 });
    }

    // Get project brand
    const { data: project } = await supabase
      .from("projects")
      .select("target_brand")
      .eq("id", project_id)
      .is("deleted_at", null)
      .single();

    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const brandA = (project as any).target_brand;

    // Fixed models for comparisons — always no-browsing
    const models = [...COMPARISON_MODEL_IDS];

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
      },
    });

    // Increment usage counters
    await incrementComparisonsUsed(user.id).catch((err) =>
      console.error("[competitive] comparisons usage increment error:", err)
    );
    await incrementNoBrowsingPromptsUsed(user.id, comparisonPromptCost).catch((err) =>
      console.error("[competitive] no-browsing usage increment error:", err)
    );

    return NextResponse.json({ id: analysis.id }, { status: 201 });
  } catch (err) {
    console.error("[competitive/start] error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

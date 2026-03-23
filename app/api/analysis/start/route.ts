import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS, PRO_ONLY_MODEL_IDS, DEMO_MODEL_IDS } from "@/lib/engine/models";
import { inngest } from "@/lib/inngest";
import { getUserPlanLimits, getCurrentUsage, incrementBrowsingPromptsUsed, incrementNoBrowsingPromptsUsed } from "@/lib/usage";

const startSchema = z.object({
  project_id: z.string().uuid(),
  run_count: z.number().int().min(1).max(3).default(1),
  browsing: z.boolean().default(true),
});

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  try {

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, run_count, browsing: requestedBrowsing } = parsed.data;

    // Auto-fail stale running runs (older than 30 minutes)
    await (supabase.from("analysis_runs") as any)
      .update({ status: "failed" })
      .eq("project_id", project_id)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // Fetch project (exclude soft-deleted)
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .is("deleted_at", null)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    // Read models from project config
    const models_used: string[] = (project as any).models_config ?? ["gpt-5.4-mini"];
    const validModels = models_used.filter((id: string) => ALL_MODEL_IDS.includes(id));
    if (!validModels.length) return NextResponse.json({ error: "Nessun modello valido configurato" }, { status: 400 });

    // Fetch queries and active segments
    const { data: queries } = await supabase
      .from("queries")
      .select("*")
      .eq("project_id", project_id);

    const { data: segments } = await supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", project_id)
      .eq("is_active", true);

    if (!queries?.length) return NextResponse.json({ error: "Nessuna query configurata" }, { status: 400 });

    // Plan limits check
    const plan = await getUserPlanLimits(user.id);
    const usage = await getCurrentUsage(user.id);
    const promptCost = queries.length;
    const userPlanId = plan.id ?? "demo";
    const isProPlan = userPlanId === "pro" || userPlanId === "agency";
    const isDemoPlan = userPlanId === "demo";

    // Demo plan enforcement: only fixed models, no browsing
    if (isDemoPlan) {
      const demoIds = new Set(DEMO_MODEL_IDS as readonly string[]);
      const invalidModels = validModels.filter((id: string) => !demoIds.has(id));
      if (invalidModels.length > 0) {
        return NextResponse.json({ error: "Il piano Demo consente solo GPT-5.4 Mini e Gemini 3.1 Pro." }, { status: 403 });
      }
    }

    // Browsing enforcement: demo plan cannot use browsing
    const browsing = isDemoPlan ? false : requestedBrowsing;

    // Check for Pro-only models on non-Pro plans
    if (!isProPlan) {
      const proModelsUsed = validModels.filter((id: string) => PRO_ONLY_MODEL_IDS.has(id));
      // Demo has gemini-3.1-pro which is normally pro-only, but allowed for demo
      const filteredProModels = isDemoPlan
        ? proModelsUsed.filter((id: string) => !(DEMO_MODEL_IDS as readonly string[]).includes(id))
        : proModelsUsed;
      if (filteredProModels.length > 0) {
        return NextResponse.json({ error: `${filteredProModels.join(", ")} disponibile solo dal piano Pro.` }, { status: 403 });
      }
    }

    if (validModels.length > plan.max_models_per_project) {
      return NextResponse.json({ error: `Il tuo piano supporta max ${plan.max_models_per_project} modelli per progetto.` }, { status: 403 });
    }

    // Browsing counter logic (plan limit + extra purchased)
    if (browsing) {
      const totalBrowsingAvailable = Number(plan.browsing_prompts) + usage.extraBrowsingPrompts;
      if (usage.browsingPromptsUsed + promptCost > totalBrowsingAvailable) {
        return NextResponse.json({
          error: `Hai esaurito i prompt con browsing di questo mese. Puoi continuare senza browsing.`,
        }, { status: 403 });
      }
    } else {
      const totalNoBrowsingAvailable = Number(plan.no_browsing_prompts) + usage.extraNoBrowsingPrompts;
      if (usage.noBrowsingPromptsUsed + promptCost > totalNoBrowsingAvailable) {
        return NextResponse.json({
          error: "Hai esaurito i prompt disponibili questo mese.",
        }, { status: 403 });
      }
    }

    // Count existing runs for version number
    const { count: existingRuns } = await supabase
      .from("analysis_runs")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);

    const totalPrompts = queries.length * Math.max((segments ?? []).length, 1) * validModels.length * run_count;

    // Create analysis run
    const { data: run, error: runError } = await (supabase.from("analysis_runs") as any)
      .insert({
        project_id,
        version: (existingRuns ?? 0) + 1,
        status: "running",
        models_used: validModels,
        run_count,
        total_prompts: totalPrompts,
        completed_prompts: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

    // Trigger Inngest function — returns immediately
    await inngest.send({
      name: "analysis/start",
      data: {
        runId: run.id,
        projectId: project_id,
        modelsUsed: validModels,
        runCount: run_count,
        browsing,
      },
    });

    // Increment the appropriate usage counter
    if (browsing) {
      await incrementBrowsingPromptsUsed(user.id, promptCost).catch((err) =>
        console.error("[analysis/start] browsing usage increment error:", err)
      );
    } else {
      await incrementNoBrowsingPromptsUsed(user.id, promptCost).catch((err) =>
        console.error("[analysis/start] no-browsing usage increment error:", err)
      );
    }

    return NextResponse.json({
      run_id: run.id,
      total_prompts: totalPrompts,
      status: "started",
    }, { status: 200 });

  } catch (err) {
    console.error("[analysis/start] unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS } from "@/lib/engine/models";
import { inngest } from "@/lib/inngest";
import { getUserPlanLimits, getCurrentUsage, incrementPromptsUsed } from "@/lib/usage";

const startSchema = z.object({
  project_id: z.string().uuid(),
  run_count: z.number().int().min(1).max(3).default(1),
  browsing: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, run_count, browsing } = parsed.data;

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
    const models_used: string[] = (project as any).models_config ?? ["gpt-4o-mini"];
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
    const promptCost = queries.length * validModels.length * run_count;

    if (validModels.length > plan.max_models_per_project) {
      return NextResponse.json({ error: `Il tuo piano supporta max ${plan.max_models_per_project} modelli per progetto.` }, { status: 403 });
    }

    if (usage.promptsUsed + promptCost > plan.monthly_prompts) {
      return NextResponse.json({ error: "Hai esaurito i prompt mensili del tuo piano. Passa al piano Pro per continuare." }, { status: 403 });
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

    // Increment usage
    await incrementPromptsUsed(user.id, promptCost).catch((err) =>
      console.error("[analysis/start] usage increment error:", err)
    );

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

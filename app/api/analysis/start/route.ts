import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS } from "@/lib/engine/models";
import { inngest } from "@/lib/inngest";

const startSchema = z.object({
  project_id: z.string().uuid(),
  models_used: z.array(z.string()).min(1).refine(
    (ids) => ids.every((id) => ALL_MODEL_IDS.includes(id)),
    { message: "Modello non supportato" }
  ),
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

    const { project_id, models_used, run_count, browsing } = parsed.data;

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

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
    if (!segments?.length) return NextResponse.json({ error: "Nessun segmento attivo" }, { status: 400 });

    // Count existing runs for version number
    const { count: existingRuns } = await supabase
      .from("analysis_runs")
      .select("*", { count: "exact", head: true })
      .eq("project_id", project_id);

    const totalPrompts = queries.length * segments.length * models_used.length * run_count;

    // Create analysis run
    const { data: run, error: runError } = await (supabase.from("analysis_runs") as any)
      .insert({
        project_id,
        version: (existingRuns ?? 0) + 1,
        status: "running",
        models_used,
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
        modelsUsed: models_used,
        runCount: run_count,
        browsing,
      },
    });

    return NextResponse.json({
      run_id: run.id,
      total_prompts: totalPrompts,
      status: "started",
    }, { status: 200 });

  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS, PRO_ONLY_MODEL_IDS, DEMO_MODEL_IDS } from "@citationrate/llm-client";
import { inngest } from "@/lib/inngest";
import { getUserPlanLimits, getCurrentUsage, getWallet } from "@/lib/usage";
import { resolvePlanLimit, isUnlimitedLimit } from "@/lib/plan-limits";
import { checkRateLimit } from "@/lib/rate-limit";

const startSchema = z.object({
  project_id: z.string().uuid(),
  run_count: z.number().int().min(1).max(3).default(1),
  browsing: z.boolean().default(true),
  query_source: z.enum(["plan", "wallet"]).default("plan"),
});

export async function POST(request: Request) {
  const { supabase, user, error } = await requireAuth();
  if (error) return error;

  // M3: Rate limit — 5 analysis starts per user per minute
  if (!checkRateLimit(`analysis-start:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Troppo veloce, riprova tra poco" }, { status: 429 });
  }

  try {

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

    const { project_id, run_count, browsing: requestedBrowsing, query_source } = parsed.data;

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
    let validModels = models_used.filter((id: string) => ALL_MODEL_IDS.includes(id));
    if (!validModels.length) return NextResponse.json({ error: "Nessun modello valido configurato" }, { status: 400 });

    // Fetch only active queries and active segments
    const { data: queries } = await supabase
      .from("queries")
      .select("*")
      .eq("project_id", project_id)
      .neq("is_active", false);

    const { data: segments } = await supabase
      .from("audience_segments")
      .select("*")
      .eq("project_id", project_id)
      .eq("is_active", true);

    if (!queries?.length) return NextResponse.json({ error: "Nessuna query configurata" }, { status: 400 });

    // Plan limits check
    const plan = await getUserPlanLimits(user.id);
    const usage = await getCurrentUsage(user.id);
    const segmentCount = Math.max((segments?.length ?? 0), 1);
    const userPlanId = (plan as any).id ?? "demo";
    const isProPlan = userPlanId === "pro" || userPlanId === "enterprise";
    const isDemoPlan = userPlanId === "demo";

    // Demo plan enforcement: only fixed models, no browsing
    if (isDemoPlan) {
      const demoIds = new Set(DEMO_MODEL_IDS as readonly string[]);
      const invalidModels = validModels.filter((id: string) => !demoIds.has(id));
      if (invalidModels.length > 0) {
        return NextResponse.json({ error: "Il piano Demo consente solo GPT-5.4 Mini e Gemini 2.5 Flash." }, { status: 403 });
      }
    }

    // Browsing enforcement: demo plan cannot use browsing
    const browsing = isDemoPlan ? false : requestedBrowsing;

    // Pro-only models on non-Pro plans:
    //   - Demo: hard-blocked above already (only DEMO_MODEL_IDS allowed).
    //   - Base (post-downgrade or legacy): SOFT SKIP — silently exclude pro-only
    //     from this run so the user isn't stuck. Historical scores remain in the
    //     project, the project page surfaces a banner with the upgrade CTA.
    if (!isProPlan && !isDemoPlan) {
      const proInProject = validModels.filter((id: string) => PRO_ONLY_MODEL_IDS.has(id));
      if (proInProject.length > 0) {
        console.warn(`[analysis/start] Base plan — skipping pro-only models: ${proInProject.join(", ")}`);
        validModels = validModels.filter((id: string) => !PRO_ONLY_MODEL_IDS.has(id));
        if (!validModels.length) {
          return NextResponse.json(
            { error: "Tutti i modelli del progetto richiedono il piano Pro. Passa a Pro o aggiungi un modello compatibile." },
            { status: 403 }
          );
        }
      }
    }

    const promptCost = queries.length * validModels.length * segmentCount * run_count;
    console.log("[analysis/start] plan:", userPlanId, "promptCost:", promptCost);

    if (validModels.length > plan.max_models_per_project) {
      return NextResponse.json({ error: `Il tuo piano supporta max ${plan.max_models_per_project} modelli per progetto.` }, { status: 403 });
    }

    // Hard block: enforce prompt limits for ALL plans (server-side)
    if (query_source === "wallet") {
      const wallet = await getWallet(user.id);
      const walletAvail = browsing ? wallet.browsingQueries : wallet.noBrowsingQueries;
      if (promptCost > walletAvail) {
        return NextResponse.json({
          error: `Wallet insufficiente: questa analisi richiede ${promptCost} prompt ma nel wallet ne hai ${walletAvail}. Usa il piano mensile o acquista query extra.`,
        }, { status: 403 });
      }
    } else {
      // NULL on the plan limit columns = unlimited (Enterprise convention,
      // see lib/plan-limits.ts). resolvePlanLimit collapses NULL to a large
      // finite sentinel, so we can compare as usual.
      const browsingBase = resolvePlanLimit((plan as any).browsing_prompts, 0);
      const noBrowsingBase = resolvePlanLimit((plan as any).no_browsing_prompts, 0);
      const totalBrowsingAvailable = isUnlimitedLimit(browsingBase)
        ? browsingBase
        : browsingBase + Number(usage.extraBrowsingPrompts || 0);
      const totalNoBrowsingAvailable = isUnlimitedLimit(noBrowsingBase)
        ? noBrowsingBase
        : noBrowsingBase + Number(usage.extraNoBrowsingPrompts || 0);

      if (browsing) {
        const remaining = totalBrowsingAvailable - Number(usage.browsingPromptsUsed || 0);
        if (promptCost > remaining) {
          return NextResponse.json({
            error: `Prompt insufficienti: questa analisi richiede ${promptCost} prompt con browsing ma te ne restano ${Math.max(0, remaining)}. Disattiva il browsing o riduci le query.`,
          }, { status: 403 });
        }
      } else {
        const remaining = totalNoBrowsingAvailable - Number(usage.noBrowsingPromptsUsed || 0);
        if (promptCost > remaining) {
          return NextResponse.json({
            error: `Prompt insufficienti: questa analisi richiede ${promptCost} prompt ma te ne restano ${Math.max(0, remaining)}. Riduci le query o passa a un piano superiore.`,
          }, { status: 403 });
        }
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

    // Trigger Inngest function — credit deduction happens inside the function
    // AFTER the analysis is confirmed started, not here (fire-and-forget).
    // If Inngest fails to pick up the event, no credits are lost.
    await inngest.send({
      name: "analysis/start",
      data: {
        runId: run.id,
        projectId: project_id,
        modelsUsed: validModels,
        runCount: run_count,
        browsing,
        // Pass billing context so Inngest can deduct after confirming start
        billing: {
          userId: user.id,
          querySource: query_source,
          promptCost,
        },
      },
    });

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

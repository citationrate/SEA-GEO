import { requireAuth } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ALL_MODEL_IDS, PRO_ONLY_MODEL_IDS, ENTERPRISE_ONLY_MODEL_IDS, DEMO_MODEL_IDS } from "@citationrate/llm-client";
import { inngest } from "@/lib/inngest";
import { getUserPlanLimits, getCurrentUsage, getWallet } from "@/lib/usage";
import { resolvePlanLimit, isUnlimitedLimit } from "@/lib/plan-limits";
import { checkRateLimit } from "@/lib/rate-limit";

const startSchema = z.object({
  project_id: z.string().uuid(),
  argomento_id: z.string().uuid(),
  run_count: z.number().int().min(1).max(3).default(1),
  browsing: z.boolean().default(true),
  query_source: z.enum(["plan", "wallet"]).default("plan"),
  // Override opzionali (lancio in-suite "scegli quante query/modelli"). Additivi:
  // se assenti, comportamento invariato (tutte le query attive + modelli progetto).
  query_ids: z.array(z.string().uuid()).min(1).optional(),
  models: z.array(z.string()).min(1).optional(),
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

    const { project_id, argomento_id, run_count, browsing: requestedBrowsing, query_source, query_ids: queryIdsOverride, models: modelsOverride } = parsed.data;

    // Billing a TOKEN dal suite: se la chiamata porta il secret server-to-server
    // valido, il run è già stato pagato a token a monte (route suite /api/avi/launch)
    // → si SALTA il gate legacy sui crediti-prompt. Il secret non è mai esposto al
    // client, quindi non è aggirabile. I crediti-prompt restano per gli utenti
    // diretti del sottodominio avi.citationrate.com.
    const launchSecret = process.env.CR_AVI_LAUNCH_SECRET || "";
    const tokenBilled = launchSecret.length > 0 && request.headers.get("x-cr-launch-secret") === launchSecret;

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

    // Validate argomento belongs to project
    const { data: argomento } = await (supabase.from("argomenti") as any)
      .select("id")
      .eq("id", argomento_id)
      .eq("project_id", project_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!argomento) return NextResponse.json({ error: "Argomento non trovato" }, { status: 404 });

    // Read models from project config. Override opzionale: limita ai modelli scelti
    // CHE IL PROGETTO HA GIÀ configurato (nessuna escalation di piano).
    let models_used: string[] = (project as any).models_config ?? ["gpt-5.4-mini"];
    if (modelsOverride?.length) {
      const picked = models_used.filter((id: string) => modelsOverride.includes(id));
      models_used = picked.length ? picked : models_used;
    }
    let validModels = models_used.filter((id: string) => ALL_MODEL_IDS.includes(id));
    if (!validModels.length) return NextResponse.json({ error: "Nessun modello valido configurato" }, { status: 400 });

    // Fetch only active, non-soft-deleted queries for this argomento.
    // Override opzionale: solo il sottoinsieme scelto (lancio in-suite).
    const { data: allQueries } = await (supabase
      .from("queries") as any)
      .select("*")
      .eq("project_id", project_id)
      .eq("argomento_id", argomento_id)
      .neq("is_active", false)
      .is("deleted_at", null);
    const queries = queryIdsOverride?.length
      ? (allQueries ?? []).filter((q: any) => queryIdsOverride.includes(q.id))
      : (allQueries ?? []);

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

    // Demo plan enforcement: only fixed models, no browsing, max 2 queries.
    // Demo set ora include 4 motori (ChatGPT, Gemini, Claude, Perplexity)
    // per massimizzare l'impatto emotivo del confronto cross-AI. Vedi
    // DEMO_MODEL_IDS in packages/llm-client/src/models.ts.
    if (isDemoPlan) {
      const demoIds = new Set(DEMO_MODEL_IDS as readonly string[]);
      const invalidModels = validModels.filter((id: string) => !demoIds.has(id));
      if (invalidModels.length > 0) {
        return NextResponse.json({ error: "Il piano Demo consente solo i 4 motori predefiniti (ChatGPT, Gemini, Claude, Perplexity)." }, { status: 403 });
      }
      // Hard cap query: la UI di /queries/generate ne forza 2 per demo,
      // questo è il guard server-side che intercetta anche chi inserisce
      // query manualmente o riusa progetti pre-lockdown.
      if (queries.length > 2) {
        return NextResponse.json({ error: "Il piano Demo consente massimo 2 query per analisi. Passa a Base per usarne fino a 100." }, { status: 403 });
      }
    }

    // Browsing enforcement: demo plan cannot use browsing
    const browsing = isDemoPlan ? false : requestedBrowsing;

    // Demo plan: hard cap a 1 run per analisi. La demo è pensata come
    // assaggio, non come strumento ricorrente — più run servono per
    // misurare consistency, che è un feature dei piani paganti.
    const effectiveRunCount = isDemoPlan ? 1 : run_count;

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

    // Enterprise-only models on non-Enterprise plans — soft skip with the same
    // rationale as Pro-gated above. Pro users get the rest of the project's
    // models; if every selected model is enterprise-only, hard-fail with a
    // clear message instead of running an empty analysis. No active
    // enterprise-only models today; gating kept as a no-op for future use.
    if (userPlanId !== "enterprise") {
      const entInProject = validModels.filter((id: string) => ENTERPRISE_ONLY_MODEL_IDS.has(id));
      if (entInProject.length > 0) {
        console.warn(`[analysis/start] non-enterprise plan (${userPlanId}) — skipping enterprise-only models: ${entInProject.join(", ")}`);
        validModels = validModels.filter((id: string) => !ENTERPRISE_ONLY_MODEL_IDS.has(id));
        if (!validModels.length) {
          return NextResponse.json(
            { error: "Tutti i modelli del progetto richiedono il piano Enterprise. Aggiungi un modello compatibile o contattaci per l'upgrade." },
            { status: 403 }
          );
        }
      }
    }

    const promptCost = queries.length * validModels.length * segmentCount * effectiveRunCount;
    console.log("[analysis/start] plan:", userPlanId, "promptCost:", promptCost);

    if (validModels.length > plan.max_models_per_project) {
      return NextResponse.json({ error: `Il tuo piano supporta max ${plan.max_models_per_project} modelli per progetto.` }, { status: 403 });
    }

    // Hard block: enforce prompt limits (LEGACY per-plan credits). Skipped when
    // the run is token-billed via the suite (x-cr-launch-secret valido): in quel
    // caso il billing è già avvenuto sul backend token a monte.
    if (!tokenBilled) {
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
    } // fine gate legacy crediti-prompt (saltato se tokenBilled)

    // Count existing runs for version number (scoped per argomento)
    const { count: existingRuns } = await (supabase
      .from("analysis_runs") as any)
      .select("*", { count: "exact", head: true })
      .eq("argomento_id", argomento_id);

    const totalPrompts = queries.length * Math.max((segments ?? []).length, 1) * validModels.length * effectiveRunCount;

    // Create analysis run
    const { data: run, error: runError } = await (supabase.from("analysis_runs") as any)
      .insert({
        project_id,
        argomento_id,
        version: (existingRuns ?? 0) + 1,
        status: "running",
        models_used: validModels,
        run_count: effectiveRunCount,
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
        argomentoId: argomento_id,
        modelsUsed: validModels,
        runCount: effectiveRunCount,
        browsing,
        // Sottoinsieme di query scelto (lancio in-suite): il worker deve eseguire
        // SOLO queste, altrimenti completed_prompts supera total_prompts (barra >100%).
        queryIds: queryIdsOverride ?? null,
        // Pass billing context so Inngest can deduct after confirming start
        billing: {
          userId: user.id,
          querySource: query_source,
          promptCost,
          // token-billed dal suite → l'Inngest NON deve dedurre i crediti-prompt legacy
          source: tokenBilled ? "token" : "plan",
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

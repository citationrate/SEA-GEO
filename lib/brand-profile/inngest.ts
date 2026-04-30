import { callAIModel, filterAvailableModels } from "@citationrate/llm-client";
import { inngest } from "@/lib/inngest";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchCSDiagnostics } from "./cs-bridge";
import { extractByPillar, type PillarExtraction } from "./extractor";
import { buildPrompts, type Pillar } from "./prompts";
import { computeScores } from "./scoring";

export const BRAND_PROFILE_START_EVENT = "brand-profile/start";

interface RunPayload {
  runId: string;
  userId: string;
  brand: string;
  brandUrl: string | null;
  sector: string;
  country: string;
  locale: string;
  models: string[];
}

const BATCH_SIZE = 5;

export const runBrandProfile = inngest.createFunction(
  {
    id: "brand-profile-run",
    concurrency: { limit: 100 },
    retries: 2,
    onFailure: async ({ event: failEvent }) => {
      try {
        const originalData = (failEvent.data as any)?.event?.data as RunPayload | undefined;
        if (!originalData?.runId) return;
        const svc = createServiceClient();
        const errorMsg =
          (failEvent.data as any)?.error?.message ?? "Errore sconosciuto (retries esauriti)";
        await (svc.schema("brand_profile" as any).from("runs") as any)
          .update({
            status: "failed",
            error_message: String(errorMsg).substring(0, 1000),
            completed_at: new Date().toISOString(),
          })
          .eq("id", originalData.runId);
      } catch (e) {
        console.error("[brand-profile/onFailure] could not update run status:", e);
      }
    },
  },
  { event: BRAND_PROFILE_START_EVENT },
  async ({ event, step }) => {
    const data = event.data as RunPayload;
    const svc = createServiceClient();
    const bp = svc.schema("brand_profile" as any);

    const models = filterAvailableModels(data.models);
    if (models.length === 0) {
      await (bp.from("runs") as any)
        .update({
          status: "failed",
          error_message: "Nessun modello disponibile — verifica le credenziali API",
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.runId);
      return { status: "failed", reason: "no available models" };
    }

    await step.run("mark-running", async () => {
      await (bp.from("runs") as any)
        .update({ status: "running" })
        .eq("id", data.runId);
    });

    const prompts = buildPrompts({
      brand: data.brand,
      sector: data.sector,
      country: data.country,
      locale: data.locale,
    });
    const tasks = prompts.flatMap((p) => models.map((model) => ({ ...p, model })));

    const allExtractions: PillarExtraction[] = [];
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const batchResults = await step.run(`batch-${i}`, async () => {
        const results = await Promise.all(
          batch.map(async (task) => {
            try {
              const t0 = Date.now();
              const llm = await callAIModel(task.text, task.model, false, data.brandUrl ?? "");
              const durationMs = Date.now() - t0;
              const responseRaw = llm.text ?? "";
              if (!responseRaw) {
                await (bp.from("prompt_results") as any).insert({
                  run_id: data.runId,
                  pillar: task.pillar,
                  prompt_index: task.index,
                  prompt_text: task.text,
                  model: task.model,
                  error_message: llm.error ?? "Empty response",
                });
                return null;
              }

              const ext = await extractByPillar({
                pillar: task.pillar,
                brand: data.brand,
                sector: data.sector,
                prompt_text: task.text,
                response_raw: responseRaw,
              });

              const d = ext.data as any;
              await (bp.from("prompt_results") as any).insert({
                run_id: data.runId,
                pillar: task.pillar,
                prompt_index: task.index,
                prompt_text: task.text,
                model: task.model,
                response_raw: responseRaw,
                response_json: d,
                brand_mentioned: d.brand_mentioned ?? null,
                brand_position: d.brand_position ?? null,
                sentiment_score: task.pillar === "sentiment" ? d.sentiment_score ?? null : null,
                tone_score: d.tone_score ?? d.tone_authoritative ?? null,
                duration_ms: durationMs,
              });
              return ext;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await (bp.from("prompt_results") as any).insert({
                run_id: data.runId,
                pillar: task.pillar,
                prompt_index: task.index,
                prompt_text: task.text,
                model: task.model,
                error_message: msg.substring(0, 1000),
              });
              return null;
            }
          }),
        );
        return results;
      });
      for (const r of batchResults) if (r) allExtractions.push(r as PillarExtraction);
    }

    await step.run("compute-scores", async () => {
      const { scores, breakdown } = computeScores(
        allExtractions.map((e) => ({ pillar: e.pillar as Pillar, data: e.data })),
      );
      await (bp.from("scores") as any).upsert(
        {
          run_id: data.runId,
          recognition: scores.recognition,
          clarity: scores.clarity,
          authority: scores.authority,
          relevance: scores.relevance,
          sentiment: scores.sentiment,
          total: scores.total,
          breakdown,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "run_id" },
      );
    });

    await step.run("cs-bridge", async () => {
      try {
        const diagnostics = await fetchCSDiagnostics({
          userId: data.userId,
          brandUrl: data.brandUrl,
        });
        if (diagnostics.length > 0) {
          await (bp.from("diagnostics") as any).insert(
            diagnostics.map((d) => ({ run_id: data.runId, ...d })),
          );
        }
      } catch (e) {
        console.error("[brand-profile/cs-bridge] non-fatal:", e);
      }
    });

    await step.run("finalize", async () => {
      await (bp.from("runs") as any)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.runId);
    });

    return { status: "completed", runId: data.runId, prompts: tasks.length };
  },
);

import { callAIModel, filterAvailableModels } from "@citationrate/llm-client";
import { inngest } from "@/lib/inngest";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchCSDiagnostics, type DiagnosticEntry } from "./cs-bridge";
import { extractByPillar, type PillarExtraction } from "./extractor";
import { generateInsights, type Pillar as InsightPillar } from "./insights";
import { buildPrompts, type Pillar } from "./prompts";
import {
  getCachedPromptResponse,
  isCacheablePillarPrompt,
  setCachedPromptResponse,
} from "./prompt-cache";
import { computeScores } from "./scoring";
import { sendFailureAlert } from "@/lib/webhooks/alert-email";
import { sendD4BP } from "@/lib/email/lifecycle/send-d4";

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

// 50 main tasks (10 prompts × 5 models) processed in parallel batches.
// Bumped 5→10: rate limits OK on all 5 providers (lowest is Gemini Flash
// free at 15 RPM; 10 parallel finishes in <1s well inside that budget).
// Reduces wall-clock from ~2 min to ~1 min and halves Inngest step overhead.
const BATCH_SIZE = 10;

export const runBrandProfile = inngest.createFunction(
  {
    id: "brand-profile-run",
    concurrency: { limit: 10 },
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

        try {
          const crSvc = createServiceClient();
          const userEmail = await crSvc.rpc("get_users_email").then((r: any) =>
            (r.data || []).find((u: any) => u.id === originalData.userId)?.email || "—"
          );
          await sendFailureAlert({
            tool: "Brand Profile",
            brand: originalData.brand || "—",
            userEmail,
            userId: originalData.userId || "—",
            errorMessage: String(errorMsg).substring(0, 500),
            runId: originalData.runId,
          });
        } catch (alertErr) {
          console.error("[brand-profile/onFailure] alert email failed:", alertErr);
        }
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
      const errorMsg = "Nessun modello disponibile — verifica le credenziali API";
      await (bp.from("runs") as any)
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.runId);

      try {
        const crSvc = createServiceClient();
        const userEmail = await crSvc.rpc("get_users_email").then((r: any) =>
          (r.data || []).find((u: any) => u.id === data.userId)?.email || "—"
        );
        await sendFailureAlert({
          tool: "Brand Profile",
          brand: data.brand || "—",
          userEmail,
          userId: data.userId || "—",
          errorMessage: errorMsg,
          runId: data.runId,
        });
      } catch (alertErr) {
        console.error("[brand-profile] alert email failed:", alertErr);
      }

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

              // Cross-brand cache: Recognition + Authority prompts depend
              // only on (sector, country), so the same response is reused
              // across all brands sharing that pair. Hit = 0 API cost.
              // Miss = normal API call + write-through.
              const cacheable = isCacheablePillarPrompt(task.pillar, task.index);
              let responseRaw = "";
              let llmError: string | undefined;
              let durationMs = 0;
              let cacheHit = false;

              if (cacheable) {
                const cached = await getCachedPromptResponse({
                  promptText: task.text,
                  model: task.model,
                  country: data.country,
                  sector: data.sector,
                });
                if (cached) {
                  responseRaw = cached.responseRaw;
                  cacheHit = true;
                  durationMs = Date.now() - t0;
                }
              }

              if (!cacheHit) {
                const llm = await callAIModel(task.text, task.model, false, data.brandUrl ?? "", {
                  product: "brand_profile",
                  operation: "brand_profile",
                  userId: data.userId,
                  runId: data.runId,
                  meta: { pillar: task.pillar, prompt_index: task.index, cache_hit: false },
                }, {
                  // Pillar scores are 1/N averages over a handful of prompts;
                  // at T=0.7 a single re-roll can flip a "brand mentioned" answer
                  // and shift a pillar by 15-20 pts in 5 minutes. T=0 makes
                  // back-to-back runs reproducible within tokenizer noise.
                  temperature: 0,
                  // BP pillar prompts ask short evaluative answers ("describe
                  // in 3-5 sentences", "list top 10 brands"). The historical
                  // 4096 default is overkill — measured output avg is 400-867
                  // tokens. First attempt with 800 (2026-05-22) caused Gemini
                  // to hit MAX_TOKENS finish reason and return empty content
                  // (Gemini reserves part of the budget for internal reasoning
                  // before emitting text; at 800 it sometimes ran out before
                  // any text). Raised to 1500 which still trims Sonar/Sonnet
                  // verbosity without starving Gemini. Watch for
                  // `[Gemini] Gemini returned empty response` in
                  // prompt_results as the regression signal.
                  maxOutputTokens: 1500,
                });
                durationMs = Date.now() - t0;
                responseRaw = llm.text ?? "";
                llmError = llm.error;

                // Write-through on cacheable misses. Failure is silent (best
                // effort — the audit continues regardless).
                if (cacheable && responseRaw) {
                  void setCachedPromptResponse({
                    promptText: task.text,
                    model: task.model,
                    country: data.country,
                    sector: data.sector,
                    pillar: task.pillar,
                    responseRaw,
                  });
                }
              }

              if (!responseRaw) {
                await (bp.from("prompt_results") as any).insert({
                  run_id: data.runId,
                  pillar: task.pillar,
                  prompt_index: task.index,
                  prompt_text: task.text,
                  model: task.model,
                  error_message: llmError ?? "Empty response",
                });
                return null;
              }

              const ext = await extractByPillar(
                {
                  pillar: task.pillar,
                  brand: data.brand,
                  sector: data.sector,
                  prompt_text: task.text,
                  response_raw: responseRaw,
                },
                { userId: data.userId, runId: data.runId },
              );

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

    const computed = await step.run("compute-scores", async () => {
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
      return { scores, breakdown };
    });

    const diagnostics = await step.run("cs-bridge", async () => {
      try {
        const found = await fetchCSDiagnostics({
          userId: data.userId,
          brandUrl: data.brandUrl,
        });
        if (found.length > 0) {
          await (bp.from("diagnostics") as any).insert(
            found.map((d) => ({ run_id: data.runId, ...d })),
          );
        }
        return found as DiagnosticEntry[];
      } catch (e) {
        console.error("[brand-profile/cs-bridge] non-fatal:", e);
        return [] as DiagnosticEntry[];
      }
    });

    await step.run("generate-insights", async () => {
      try {
        // Insights stability: if the user just re-ran the same brand and
        // every pillar moved by ≤5 pts vs the previous completed run within
        // the last 30 days, REUSE that run's insights instead of asking
        // Sonnet for a fresh set. Two reasons:
        //   1) UX: users complained that bullets change between runs even
        //      when the score is essentially unchanged. Sonnet picks 3 of
        //      hundreds of plausible actions; consistency feels broken.
        //   2) Cost: each fresh insights call is ~$0.05; on a "monitoring"
        //      pattern (weekly re-runs of stable brands) this is wasted.
        const PILLAR_STABILITY_THRESHOLD = 5;
        const CACHE_WINDOW_DAYS = 30;

        const currScores = {
          recognition: Number(computed.scores.recognition ?? 0),
          clarity: Number(computed.scores.clarity ?? 0),
          authority: Number(computed.scores.authority ?? 0),
          relevance: Number(computed.scores.relevance ?? 0),
          sentiment: Number(computed.scores.sentiment ?? 0),
        };

        const since = new Date(Date.now() - CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data: prevRun } = await (bp.from("runs") as any)
          .select("id, started_at")
          .eq("user_id", data.userId)
          .eq("brand_name", data.brand)
          .eq("status", "completed")
          .neq("id", data.runId)
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let reusedFromRunId: string | null = null;
        if (prevRun) {
          const { data: prevScores } = await (bp.from("scores") as any)
            .select("recognition, clarity, authority, relevance, sentiment")
            .eq("run_id", prevRun.id)
            .maybeSingle();
          if (prevScores) {
            const maxDelta = Math.max(
              Math.abs(currScores.recognition - Number(prevScores.recognition ?? 0)),
              Math.abs(currScores.clarity - Number(prevScores.clarity ?? 0)),
              Math.abs(currScores.authority - Number(prevScores.authority ?? 0)),
              Math.abs(currScores.relevance - Number(prevScores.relevance ?? 0)),
              Math.abs(currScores.sentiment - Number(prevScores.sentiment ?? 0)),
            );
            if (maxDelta <= PILLAR_STABILITY_THRESHOLD) {
              const { data: prevInsights } = await (bp.from("insights") as any)
                .select("pillar, insight_text, model")
                .eq("run_id", prevRun.id);
              if (prevInsights && (prevInsights as any[]).length > 0) {
                const cloned = (prevInsights as any[]).map((row) => ({
                  run_id: data.runId,
                  pillar: row.pillar,
                  insight_text: row.insight_text,
                  model: row.model,
                }));
                await (bp.from("insights") as any).insert(cloned);
                reusedFromRunId = prevRun.id;
                console.log(`[brand-profile/insights] reused from run=${prevRun.id} (maxDelta=${maxDelta.toFixed(1)})`);
                return;
              }
            }
          }
        }

        // Cache miss → generate fresh
        if (reusedFromRunId === null) {
          const { data: rows } = await (bp.from("prompt_results") as any)
            .select("pillar, response_raw")
            .eq("run_id", data.runId);
          const responsesByPillar: Record<InsightPillar, string[]> = {
            recognition: [],
            clarity: [],
            authority: [],
            relevance: [],
            sentiment: [],
          };
          for (const r of (rows ?? []) as any[]) {
            const p = r.pillar as InsightPillar;
            if (!p || !responsesByPillar[p]) continue;
            if (r.response_raw && typeof r.response_raw === "string") {
              responsesByPillar[p].push(r.response_raw as string);
            }
          }
          const { insights, model } = await generateInsights(
            {
              brand: data.brand,
              sector: data.sector,
              country: data.country,
              locale: data.locale,
              scores: currScores,
              breakdown: computed.breakdown,
              responsesByPillar,
              diagnostics,
              modelCount: models.length,
            },
            { userId: data.userId, runId: data.runId },
          );
          const rowsToInsert: any[] = [];
          (Object.keys(insights) as InsightPillar[]).forEach((p) => {
            insights[p].forEach((text) => {
              rowsToInsert.push({
                run_id: data.runId,
                pillar: p,
                insight_text: text,
                model,
              });
            });
          });
          if (rowsToInsert.length > 0) {
            await (bp.from("insights") as any).insert(rowsToInsert);
          }
        }
      } catch (e) {
        console.error("[brand-profile/generate-insights] non-fatal:", e);
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

    // Send D4_BP email immediately
    await step.run("send-d4-bp-email", async () => {
      await sendD4BP({
        userId: data.userId,
        runId: data.runId,
        projectId: "",
        brand: data.brand,
      });
    });

    return { status: "completed", runId: data.runId, prompts: tasks.length };
  },
);

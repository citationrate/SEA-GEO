import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { callAIModel } from "./engine/prompt-runner";

/* ─── Helpers ─── */

const DEFAULT_MODELS = ["gpt-4o-mini", "gemini-2.5-flash"];
const RUNS_PER_QUERY = 3;

function generateQueries(brandA: string, brandB: string, driver: string): { pattern: string; text: string }[] {
  return [
    { pattern: "A", text: `Tra ${brandA} e ${brandB}, chi offre ${driver} migliore?` },
    { pattern: "B", text: `È meglio scegliere ${brandA} o ${brandB} se mi interessa soprattutto ${driver}?` },
    { pattern: "C", text: `${brandA} o ${brandB}: quale consigli considerando ${driver}?` },
  ];
}

async function evaluateResponse(
  responseText: string,
  brandA: string,
  brandB: string,
): Promise<{ recommendation: number; first_mention: string; key_arguments: string[] }> {
  const prompt = `Leggi questa risposta AI a una query comparativa tra "${brandA}" e "${brandB}".
Rispondi SOLO con un JSON valido, senza markdown o testo aggiuntivo:
{
  "recommendation": 1 se preferisce ${brandA}, 2 se preferisce ${brandB}, 0.5 se pareggio, 0 se nessuna raccomandazione,
  "first_mention": "A" se ${brandA} è citato per primo, "B" se ${brandB}, "tie" se simultanei,
  "key_arguments": [lista di max 3 argomenti principali usati dall'AI per giustificare la scelta]
}

Risposta AI da valutare:

${responseText}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
    return {
      recommendation: typeof parsed.recommendation === "number" ? parsed.recommendation : 0,
      first_mention: ["A", "B", "tie"].includes(parsed.first_mention) ? parsed.first_mention : "tie",
      key_arguments: Array.isArray(parsed.key_arguments) ? parsed.key_arguments.slice(0, 3) : [],
    };
  } catch {
    console.error("[competitive] evaluation parse failed:", cleaned.substring(0, 200));
    return { recommendation: 0, first_mention: "tie", key_arguments: [] };
  }
}

/* ─── Inngest Function ─── */

export const runCompetitiveAnalysis = inngest.createFunction(
  {
    id: "run-competitive-analysis",
    retries: 2,
    onFailure: async ({ event: failEvent }) => {
      try {
        const originalData = (failEvent.data as any)?.event?.data;
        if (!originalData?.analysisId) return;
        const supabase = createServiceClient();
        const errorMsg = (failEvent.data as any)?.error?.message ?? "Errore sconosciuto";
        await (supabase.from("competitive_analyses") as any)
          .update({ status: "failed" })
          .eq("id", originalData.analysisId);
        console.error(`[competitive/onFailure] analysis ${originalData.analysisId} failed:`, errorMsg);
      } catch (e) {
        console.error("[competitive/onFailure] could not update:", e);
      }
    },
  },
  { event: "competitive/start" },
  async ({ event, step }) => {
    const { analysisId, brandA, brandB, driver, models: eventModels } = event.data as {
      analysisId: string;
      brandA: string;
      brandB: string;
      driver: string;
      models?: string[];
    };

    const models = eventModels && eventModels.length > 0 ? eventModels : DEFAULT_MODELS;

    // Step 1: Generate queries and create prompt rows
    const queries = generateQueries(brandA, brandB, driver);

    const promptIds = await step.run("create-prompts", async () => {
      const supabase = createServiceClient();

      await (supabase.from("competitive_analyses") as any)
        .update({ status: "running" })
        .eq("id", analysisId);

      const rows: any[] = [];
      for (const q of queries) {
        for (const model of models) {
          for (let run = 1; run <= RUNS_PER_QUERY; run++) {
            rows.push({
              analysis_id: analysisId,
              pattern_type: q.pattern,
              query_text: q.text,
              model,
              run_number: run,
              status: "pending",
            });
          }
        }
      }

      const { data, error } = await (supabase.from("competitive_prompts") as any)
        .insert(rows)
        .select("id");

      if (error) throw new Error(`Failed to create prompts: ${error.message}`);
      return (data as any[]).map((r: any) => r.id);
    });

    // Step 2: Execute all prompts (batched)
    const batchSize = 3;
    const batches: string[][] = [];
    for (let i = 0; i < promptIds.length; i += batchSize) {
      batches.push(promptIds.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      await step.run(`execute-batch-${i}`, async () => {
        const supabase = createServiceClient();

        for (const promptId of batches[i]) {
          const { data: prompt } = await (supabase.from("competitive_prompts") as any)
            .select("*")
            .eq("id", promptId)
            .single();

          if (!prompt) continue;

          try {
            const result = await callAIModel(prompt.query_text, prompt.model);
            const responseText = result.text;

            await (supabase.from("competitive_prompts") as any)
              .update({
                response_text: responseText || null,
                status: responseText ? "completed" : "error",
              })
              .eq("id", promptId);
          } catch (e: any) {
            console.error(`[competitive] model call failed for ${promptId}:`, e?.message);
            await (supabase.from("competitive_prompts") as any)
              .update({ status: "error" })
              .eq("id", promptId);
          }
        }
      });
    }

    // Step 3: Evaluate all responses with LLM
    await step.run("evaluate-responses", async () => {
      const supabase = createServiceClient();

      const { data: completedPrompts } = await (supabase.from("competitive_prompts") as any)
        .select("*")
        .eq("analysis_id", analysisId)
        .eq("status", "completed");

      for (const prompt of (completedPrompts ?? []) as any[]) {
        if (!prompt.response_text) continue;

        try {
          const evaluation = await evaluateResponse(prompt.response_text, brandA, brandB);

          await (supabase.from("competitive_prompts") as any)
            .update({
              recommendation: evaluation.recommendation,
              first_mention: evaluation.first_mention,
              key_arguments: evaluation.key_arguments,
            })
            .eq("id", prompt.id);
        } catch (e: any) {
          console.error(`[competitive] evaluation failed for ${prompt.id}:`, e?.message);
        }
      }
    });

    // Step 4: Calculate KPIs
    await step.run("calculate-kpis", async () => {
      const supabase = createServiceClient();

      const { data: allPrompts } = await (supabase.from("competitive_prompts") as any)
        .select("recommendation, first_mention")
        .eq("analysis_id", analysisId)
        .eq("status", "completed");

      const prompts = (allPrompts ?? []) as any[];
      const total = prompts.length;
      if (total === 0) {
        await (supabase.from("competitive_analyses") as any)
          .update({ status: "completed" })
          .eq("id", analysisId);
        return;
      }

      const validRec = prompts.filter((p: any) => p.recommendation > 0);
      const validTotal = validRec.length || 1;

      const winsA = validRec.filter((p: any) => p.recommendation === 1).length;
      const winsB = validRec.filter((p: any) => p.recommendation === 2).length;

      const winRateA = Math.round((winsA / validTotal) * 1000) / 10;
      const winRateB = Math.round((winsB / validTotal) * 1000) / 10;

      const fmrA = Math.round((prompts.filter((p: any) => p.first_mention === "A").length / total) * 1000) / 10;
      const fmrB = Math.round((prompts.filter((p: any) => p.first_mention === "B").length / total) * 1000) / 10;

      const compScoreA = Math.round((0.6 * winRateA + 0.4 * fmrA) * 10) / 10;

      await (supabase.from("competitive_analyses") as any)
        .update({
          status: "completed",
          win_rate_a: winRateA,
          win_rate_b: winRateB,
          fmr_a: fmrA,
          fmr_b: fmrB,
          comp_score_a: compScoreA,
        })
        .eq("id", analysisId);
    });

    return { analysisId, status: "completed" };
  },
);

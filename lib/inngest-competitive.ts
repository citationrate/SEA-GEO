import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { callAIModel } from "./engine/prompt-runner";

/* ─── Helpers ─── */

const DEFAULT_MODELS = ["gpt-4o-mini", "gemini-2.5-flash"];
const RUNS_PER_QUERY = 3;

/** Capitalize first letter of each word: "mulino bianco" → "Mulino Bianco" */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface CompetitivePersona {
  id: string;
  nome?: string;
  mode: "demographic" | "decision_drivers";
  eta?: string;
  sesso?: string;
  situazione?: string;
  ruolo?: string;
  settore?: string;
  problema?: string;
}

function buildPersonaContext(p: CompetitivePersona): string {
  if (p.mode === "demographic") {
    const parts: string[] = [];
    if (p.eta) parts.push(`${p.eta} anni`);
    if (p.sesso) parts.push(p.sesso === "M" ? "uomo" : p.sesso === "F" ? "donna" : p.sesso);
    if (p.situazione) parts.push(p.situazione);
    return parts.join(", ");
  }
  const parts: string[] = [];
  if (p.ruolo) parts.push(p.ruolo);
  if (p.settore) parts.push(`settore ${p.settore}`);
  if (p.problema) parts.push(`problema: ${p.problema}`);
  return parts.join(", ");
}

function generateQueries(
  brandA: string,
  brandB: string,
  driver: string,
  personas?: CompetitivePersona[],
): { pattern: string; text: string }[] {
  const a = titleCase(brandA);
  const b = titleCase(brandB);
  const queries = [
    { pattern: "A", text: `Tra ${a} e ${b}, chi offre ${driver} migliore?` },
    { pattern: "B", text: `È meglio scegliere ${a} o ${b} se mi interessa soprattutto ${driver}?` },
    { pattern: "C", text: `${a} o ${b}: quale consigli considerando ${driver}?` },
  ];

  if (personas && personas.length > 0) {
    for (const p of personas) {
      const ctx = buildPersonaContext(p);
      if (!ctx) continue;
      const label = p.nome ? `Come ${p.nome} (${ctx})` : `Come ${ctx}`;
      queries.push(
        { pattern: "P", text: `${label}, è meglio ${a} o ${b} per ${driver}?` },
        { pattern: "P", text: `${label}, tra ${a} e ${b} quale consigli considerando ${driver}?` },
      );
    }
  }

  return queries;
}

const VALID_RECOMMENDATIONS = new Set([1, 2, 0.5]);

async function evaluateResponse(
  responseText: string,
  brandA: string,
  brandB: string,
): Promise<{ recommendation: number; first_mention: string; key_arguments: string[] }> {
  const brandANorm = titleCase(brandA);
  const brandBNorm = titleCase(brandB);
  // Show both original and normalized forms so the evaluator can match either
  const brandALabel = brandA === brandANorm ? `"${brandANorm}"` : `"${brandA}" / "${brandANorm}"`;
  const brandBLabel = brandB === brandBNorm ? `"${brandBNorm}"` : `"${brandB}" / "${brandBNorm}"`;

  const prompt = `Sei un analista competitivo. Leggi questa risposta AI a una query comparativa tra Brand A (${brandALabel}) e Brand B (${brandBLabel}).

REGOLA CASE-INSENSITIVE: I nomi dei brand possono apparire in qualsiasi capitalizzazione nella risposta. Tratta "${brandA}", "${brandANorm}", "${brandA.toUpperCase()}" come lo stesso brand (Brand A). Tratta "${brandB}", "${brandBNorm}", "${brandB.toUpperCase()}" come lo stesso brand (Brand B).

REGOLE TASSATIVE:
- recommendation DEVE essere esattamente 1, 2, o 0.5. Nessun altro valore è ammesso. Mai 0, mai 1.5, mai null.
  - 1 = la risposta favorisce Brand A ${brandALabel} (più vantaggi, tono più positivo, raccomandazione più esplicita)
  - 2 = la risposta favorisce Brand B ${brandBLabel} (più vantaggi, tono più positivo, raccomandazione più esplicita)
  - 0.5 = pareggio REALE — SOLO se entrambi i brand ricevono peso identico senza alcuna preferenza rilevabile
- Sii decisivo: anche se la risposta è diplomatica, identifica quale brand viene presentato con PIÙ vantaggi o raccomandato PIÙ esplicitamente. Usa 0.5 SOLO se è davvero impossibile distinguere una preferenza.
- first_mention: "A" se Brand A (${brandALabel}) appare per primo nel testo, "B" se Brand B (${brandBLabel}) appare per primo, "tie" se appaiono nella stessa frase iniziale.
- key_arguments: max 3 argomenti principali usati nella risposta.

ESEMPI:
- "Entrambi sono ottimi, dipende dalle preferenze" ma poi elenca 3 vantaggi di ${brandBNorm} e solo 1 di ${brandANorm} → recommendation: 2
- "${brandANorm} è leader di mercato con navi moderne e ottime recensioni" → recommendation: 1
- "Sono intercambiabili, stessa qualità, stesso prezzo, stesse rotte" → recommendation: 0.5

Rispondi SOLO con questo JSON, senza testo aggiuntivo:
{"recommendation": 1, "first_mention": "A", "key_arguments": ["arg1", "arg2"]}

Risposta AI da valutare:

${responseText}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);
    const rec = typeof parsed.recommendation === "number" ? parsed.recommendation : 0.5;
    const result = {
      recommendation: VALID_RECOMMENDATIONS.has(rec) ? rec : 0.5,
      first_mention: ["A", "B", "tie"].includes(parsed.first_mention) ? parsed.first_mention : "tie",
      key_arguments: Array.isArray(parsed.key_arguments) ? parsed.key_arguments.slice(0, 3) : [],
    };
    console.log(`[competitive/eval] brandA="${brandA}" (norm="${brandANorm}"), brandB="${brandB}" (norm="${brandBNorm}"), response_preview="${responseText.substring(0, 100)}", rec=${result.recommendation}, fm=${result.first_mention}`);
    return result;
  } catch {
    console.error("[competitive] evaluation parse failed:", cleaned.substring(0, 200));
    console.log(`[competitive/eval-fail] brandA="${brandA}" (norm="${brandANorm}"), brandB="${brandB}" (norm="${brandBNorm}"), response_preview="${responseText.substring(0, 100)}"`);
    return { recommendation: 0.5, first_mention: "tie", key_arguments: [] };
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
    const { analysisId, brandA, brandB, driver, models: eventModels, personas: eventPersonas } = event.data as {
      analysisId: string;
      brandA: string;
      brandB: string;
      driver: string;
      models?: string[];
      personas?: CompetitivePersona[];
    };

    const models = eventModels && eventModels.length > 0 ? eventModels : DEFAULT_MODELS;

    // Step 1: Generate queries and create prompt rows
    const queries = generateQueries(brandA, brandB, driver, eventPersonas);

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

        for (let j = 0; j < batches[i].length; j++) {
          const promptId = batches[i][j];
          const { data: prompt } = await (supabase.from("competitive_prompts") as any)
            .select("*")
            .eq("id", promptId)
            .single();

          if (!prompt) continue;

          // Delay between calls to avoid rate limiting (especially Gemini free tier)
          if (j > 0) {
            const isGemini = prompt.model?.startsWith("gemini");
            await new Promise((r) => setTimeout(r, isGemini ? 2000 : 500));
          }

          try {
            let result = await callAIModel(prompt.query_text, prompt.model);

            // If first attempt returned an error (e.g. rate limit), retry once with backoff
            if (!result.text && result.error) {
              console.warn(`[competitive] ${prompt.model} failed for ${promptId}: ${result.error} — retrying in 5s`);
              await new Promise((r) => setTimeout(r, 5000));
              result = await callAIModel(prompt.query_text, prompt.model);
            }

            if (!result.text && result.error) {
              console.error(`[competitive] ${prompt.model} failed permanently for ${promptId}: ${result.error}`);
            }

            const responseText = result.text;

            await (supabase.from("competitive_prompts") as any)
              .update({
                response_text: responseText || null,
                status: responseText ? "completed" : "error",
              })
              .eq("id", promptId);
          } catch (e: any) {
            console.error(`[competitive] model call threw for ${promptId}:`, e?.message);
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
          console.log(`[competitive] evaluate ${prompt.id}: rec=${evaluation.recommendation} (type=${typeof evaluation.recommendation}), fm=${evaluation.first_mention}`);

          const { error: updateErr } = await (supabase.from("competitive_prompts") as any)
            .update({
              recommendation: evaluation.recommendation,
              first_mention: evaluation.first_mention,
              key_arguments: evaluation.key_arguments,
            })
            .eq("id", prompt.id);

          if (updateErr) {
            console.error(`[competitive] update failed for ${prompt.id}:`, updateErr.message);
          }
        } catch (e: any) {
          console.error(`[competitive] evaluation failed for ${prompt.id}:`, e?.message);
        }
      }
    });

    // Step 4: Calculate KPIs
    await step.run("calculate-kpis", async () => {
      const supabase = createServiceClient();

      const { data: allPrompts, error: fetchErr } = await (supabase.from("competitive_prompts") as any)
        .select("id, recommendation, first_mention")
        .eq("analysis_id", analysisId)
        .eq("status", "completed");

      if (fetchErr) {
        console.error(`[competitive/kpis] fetch error:`, fetchErr.message);
      }

      // Log raw DB values before any conversion
      console.log(`[competitive/kpis] raw DB rows (${(allPrompts ?? []).length}):`,
        (allPrompts ?? []).map((p: any) => ({
          id: p.id?.slice(0, 8),
          rec_raw: p.recommendation,
          rec_type: typeof p.recommendation,
          fm: p.first_mention,
        }))
      );

      const prompts = (allPrompts ?? []).map((p: any) => ({
        ...p,
        recommendation: p.recommendation != null ? Number(p.recommendation) : null,
        first_mention: typeof p.first_mention === "string" ? p.first_mention.trim() : p.first_mention,
      }));
      const total = prompts.length;
      if (total === 0) {
        console.log(`[competitive/kpis] no completed prompts, skipping`);
        await (supabase.from("competitive_analyses") as any)
          .update({ status: "completed" })
          .eq("id", analysisId);
        return;
      }

      // Log converted values
      console.log(`[competitive/kpis] after Number() conversion:`,
        prompts.map((p: any) => ({
          id: p.id?.slice(0, 8),
          rec: p.recommendation,
          rec_type: typeof p.recommendation,
          fm: p.first_mention,
        }))
      );

      const validRec = prompts.filter((p: any) => p.recommendation != null && p.recommendation > 0);
      const validTotal = validRec.length || 1;

      const winsA = validRec.filter((p: any) => p.recommendation === 1).length;
      const winsB = validRec.filter((p: any) => p.recommendation === 2).length;
      const draws = validRec.filter((p: any) => p.recommendation === 0.5).length;

      console.log(`[competitive/kpis] total=${total}, validRec=${validRec.length}, winsA=${winsA}, winsB=${winsB}, draws=${draws}, validTotal=${validTotal}`);

      const winRateA = Math.round((winsA / validTotal) * 1000) / 10;
      const winRateB = Math.round((winsB / validTotal) * 1000) / 10;

      const fmrA = Math.round((prompts.filter((p: any) => p.first_mention === "A").length / total) * 1000) / 10;
      const fmrB = Math.round((prompts.filter((p: any) => p.first_mention === "B").length / total) * 1000) / 10;

      const compScoreA = Math.round((0.6 * winRateA + 0.4 * fmrA) * 10) / 10;

      console.log(`[competitive/kpis] FINAL: winRateA=${winRateA}%, winRateB=${winRateB}%, fmrA=${fmrA}%, fmrB=${fmrB}%, compScoreA=${compScoreA}`);

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

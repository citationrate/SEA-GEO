import { inngest } from "./inngest";
import { createServiceClient } from "./supabase/service";
import Anthropic from "@anthropic-ai/sdk";
import { callAIModel } from "./engine/prompt-runner";

/* ─── Helpers ─── */

const DEFAULT_MODELS = ["gpt-5.4-mini", "gemini-2.5-flash"];
const RUNS_PER_QUERY = 3;

/** Capitalize first letter of each word: "mulino bianco" → "Mulino Bianco" */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Driver-specific query templates — Italian */
const DRIVER_TEMPLATES_IT: Record<string, [string, string, string]> = {
  "reputazione": [
    "Recensioni clienti {A} vs {B}: quale ha più valutazioni positive su Google e Trustpilot ad oggi?",
    "Tra {A} e {B}, quale ha più clienti soddisfatti secondo le recensioni recenti online?",
    "{A} o {B}: qual è la reputazione online ad oggi secondo chi li ha usati?",
  ],
  "trust": [
    "Recensioni clienti {A} vs {B}: quale ha più valutazioni positive su Google e Trustpilot ad oggi?",
    "Tra {A} e {B}, quale ha più clienti soddisfatti secondo le recensioni recenti online?",
    "{A} o {B}: qual è la reputazione online ad oggi secondo chi li ha usati?",
  ],
  "prezzo": [
    "Quanto costa il servizio di {A} rispetto a {B}? Confronto prezzi reale ad oggi",
    "Per risparmiare, conviene {A} o {B} in base ai prezzi attuali?",
    "{A} vs {B}: chi offre il miglior rapporto qualità-prezzo secondo i clienti ad oggi?",
  ],
  "convenienza": [
    "Quanto costa il servizio di {A} rispetto a {B}? Confronto prezzi reale ad oggi",
    "Per risparmiare, conviene {A} o {B} in base ai prezzi attuali?",
    "{A} vs {B}: chi offre il miglior rapporto qualità-prezzo secondo i clienti ad oggi?",
  ],
  "velocità": [
    "Tempi medi di risposta e gestione pratica: {A} vs {B}, chi è più veloce ad oggi?",
    "Per una gestione rapida, meglio {A} o {B} secondo le esperienze reali dei clienti?",
    "{A} o {B}: chi risolve i casi più velocemente in base alle recensioni recenti?",
  ],
  "tempi": [
    "Tempi medi di risposta e gestione pratica: {A} vs {B}, chi è più veloce ad oggi?",
    "Per una gestione rapida, meglio {A} o {B} secondo le esperienze reali dei clienti?",
    "{A} o {B}: chi risolve i casi più velocemente in base alle recensioni recenti?",
  ],
  "servizio clienti": [
    "Assistenza clienti {A} vs {B}: chi risponde meglio secondo le recensioni online ad oggi?",
    "Tra {A} e {B}, quale ha un servizio clienti più affidabile e reattivo ad oggi?",
    "{A} o {B}: confronto supporto clienti basato su esperienze reali dei clienti",
  ],
  "assistenza": [
    "Assistenza clienti {A} vs {B}: chi risponde meglio secondo le recensioni online ad oggi?",
    "Tra {A} e {B}, quale ha un servizio clienti più affidabile e reattivo ad oggi?",
    "{A} o {B}: confronto supporto clienti basato su esperienze reali dei clienti",
  ],
  "esperienza digitale": [
    "App e sito web di {A} vs {B}: quale piattaforma digitale è più facile da usare ad oggi?",
    "Per gestire tutto online, meglio {A} o {B}? Confronto app e sito ad oggi",
    "{A} vs {B}: quale offre la migliore esperienza digitale secondo gli utenti?",
  ],
  "digitale": [
    "App e sito web di {A} vs {B}: quale piattaforma digitale è più facile da usare ad oggi?",
    "Per gestire tutto online, meglio {A} o {B}? Confronto app e sito ad oggi",
    "{A} vs {B}: quale offre la migliore esperienza digitale secondo gli utenti?",
  ],
  "sicurezza": [
    "{A} o {B}: quale è più affidabile e sicuro secondo dati e recensioni recenti?",
    "Affidabilità e solidità di {A} vs {B}: confronto basato su dati reali ad oggi",
    "Tra {A} e {B}, quale dà più garanzie ai clienti secondo le esperienze online?",
  ],
  "affidabilità": [
    "{A} o {B}: quale è più affidabile e sicuro secondo dati e recensioni recenti?",
    "Affidabilità e solidità di {A} vs {B}: confronto basato su dati reali ad oggi",
    "Tra {A} e {B}, quale dà più garanzie ai clienti secondo le esperienze online?",
  ],
};

/** Driver-specific query templates — English */
const DRIVER_TEMPLATES_EN: Record<string, [string, string, string]> = {
  "reputation": [
    "{A} vs {B} customer reviews: which has more positive ratings on Google and Trustpilot today?",
    "Between {A} and {B}, which has more satisfied customers based on recent online reviews?",
    "{A} or {B}: what is their online reputation today according to real users?",
  ],
  "trust": [
    "{A} vs {B} customer reviews: which has more positive ratings on Google and Trustpilot today?",
    "Between {A} and {B}, which has more satisfied customers based on recent online reviews?",
    "{A} or {B}: what is their online reputation today according to real users?",
  ],
  "price": [
    "How much does {A} cost compared to {B}? Real price comparison today",
    "To save money, is {A} or {B} better based on current pricing?",
    "{A} vs {B}: who offers the best value for money according to customers today?",
  ],
  "value": [
    "How much does {A} cost compared to {B}? Real price comparison today",
    "To save money, is {A} or {B} better based on current pricing?",
    "{A} vs {B}: who offers the best value for money according to customers today?",
  ],
  "speed": [
    "Average response and case handling times: {A} vs {B}, who is faster today?",
    "For quick service, is {A} or {B} better based on real customer experiences?",
    "{A} or {B}: who resolves cases faster based on recent reviews?",
  ],
  "customer service": [
    "{A} vs {B} customer support: who responds better according to online reviews today?",
    "Between {A} and {B}, which has more reliable and responsive customer service today?",
    "{A} or {B}: customer support comparison based on real customer experiences",
  ],
  "digital experience": [
    "{A} vs {B} app and website: which digital platform is easier to use today?",
    "For managing everything online, is {A} or {B} better? App and website comparison today",
    "{A} vs {B}: which offers the best digital experience according to users?",
  ],
  "reliability": [
    "{A} or {B}: which is more reliable and secure according to recent data and reviews?",
    "Reliability and strength of {A} vs {B}: comparison based on real data today",
    "Between {A} and {B}, which gives more guarantees to customers based on online experiences?",
  ],
  "security": [
    "{A} or {B}: which is more reliable and secure according to recent data and reviews?",
    "Reliability and strength of {A} vs {B}: comparison based on real data today",
    "Between {A} and {B}, which gives more guarantees to customers based on online experiences?",
  ],
};

const FALLBACK_TEMPLATES_IT: [string, string, string] = [
  "{A} vs {B}: quale è migliore per {driver} secondo le recensioni e i dati reali ad oggi?",
  "Tra {A} e {B}, chi offre {driver} migliore in base alle esperienze dei clienti ad oggi?",
  "{A} o {B}: confronto {driver} basato su dati e recensioni recenti",
];

const FALLBACK_TEMPLATES_EN: [string, string, string] = [
  "{A} vs {B}: which is better for {driver} according to real reviews and data today?",
  "Between {A} and {B}, who offers better {driver} based on customer experiences today?",
  "{A} or {B}: {driver} comparison based on recent data and reviews",
];

function generateQueries(
  brandA: string,
  brandB: string,
  driver: string,
  language: string,
): { pattern: string; text: string }[] {
  const a = titleCase(brandA);
  const b = titleCase(brandB);
  const driverKey = driver.toLowerCase().trim();

  const isEnglish = language === "en";
  const templates = isEnglish
    ? (DRIVER_TEMPLATES_EN[driverKey] ?? FALLBACK_TEMPLATES_EN)
    : (DRIVER_TEMPLATES_IT[driverKey] ?? FALLBACK_TEMPLATES_IT);

  return templates.map((tpl, i) => ({
    pattern: String.fromCharCode(65 + i),
    text: tpl
      .replace(/\{A\}/g, a)
      .replace(/\{B\}/g, b)
      .replace(/\{driver\}/g, driver),
  }));
}

const VALID_RECOMMENDATIONS = new Set([1, 2, 0.5]);

async function evaluateResponse(
  responseText: string,
  brandA: string,
  brandB: string,
  language: string,
): Promise<{ recommendation: number; first_mention: string; key_arguments: string[] }> {
  const brandANorm = titleCase(brandA);
  const brandBNorm = titleCase(brandB);
  const brandALabel = brandA === brandANorm ? `"${brandANorm}"` : `"${brandA}" / "${brandANorm}"`;
  const brandBLabel = brandB === brandBNorm ? `"${brandBNorm}"` : `"${brandB}" / "${brandBNorm}"`;

  const isEnglish = language === "en";

  const prompt = isEnglish
    ? `You are a competitive analyst. Read this AI response to a comparative query between Brand A (${brandALabel}) and Brand B (${brandBLabel}).

CASE-INSENSITIVE RULE: Brand names may appear in any capitalization. Treat "${brandA}", "${brandANorm}", "${brandA.toUpperCase()}" as Brand A. Treat "${brandB}", "${brandBNorm}", "${brandB.toUpperCase()}" as Brand B.

STRICT RULES:
- recommendation MUST be exactly 1, 2, or 0.5. Never 0, never 1.5, never null.
  - 1 = response favors Brand A ${brandALabel}
  - 2 = response favors Brand B ${brandBLabel}
  - 0.5 = REAL tie — ONLY if BOTH brands receive IDENTICAL treatment with no detectable preference

IMPLICIT PREFERENCES — READ CAREFULLY:
AI responses are often diplomatic. Do NOT be fooled by polite phrasing. Look for the IMPLICIT preference:
- "X appears more structured/visible/solid/reliable" → X WINS (even if the sentence starts with "both are good")
- "X seems to have a stronger/more established presence" → X WINS
- More advantages listed for X than Y (e.g. 3 vs 1) → X WINS
- X described with more positive adjectives than Y → X WINS
- Response suggests X as first choice or recommendation → X WINS
- Use 0.5 ONLY if language is truly identical for both, with no preference signal

- first_mention: "A" if Brand A appears first in text, "B" if Brand B appears first, "tie" if same sentence.
- key_arguments: max 3 key arguments (in English).

Respond ONLY with this JSON:
{"recommendation": 1, "first_mention": "A", "key_arguments": ["arg1", "arg2"]}

AI response to evaluate:

${responseText}`
    : `Sei un analista competitivo. Leggi questa risposta AI a una query comparativa tra Brand A (${brandALabel}) e Brand B (${brandBLabel}).

REGOLA CASE-INSENSITIVE: I nomi dei brand possono apparire in qualsiasi capitalizzazione. Tratta "${brandA}", "${brandANorm}", "${brandA.toUpperCase()}" come Brand A. Tratta "${brandB}", "${brandBNorm}", "${brandB.toUpperCase()}" come Brand B.

REGOLE TASSATIVE:
- recommendation DEVE essere esattamente 1, 2, o 0.5. Mai 0, mai 1.5, mai null.
  - 1 = la risposta favorisce Brand A ${brandALabel}
  - 2 = la risposta favorisce Brand B ${brandBLabel}
  - 0.5 = pareggio REALE — SOLO se ENTRAMBI i brand ricevono trattamento IDENTICO senza alcuna preferenza rilevabile

PREFERENZE IMPLICITE — LEGGI ATTENTAMENTE:
Le risposte AI sono spesso diplomatiche. NON farti ingannare da formule di cortesia. Cerca la preferenza IMPLICITA:
- "X appare più strutturata/visibile/solida/affidabile" → X VINCE (anche se la frase inizia con "entrambi sono buoni")
- "X sembra avere una presenza più forte/consolidata" → X VINCE
- "X mostra più vantaggi/risultati/recensioni" → X VINCE
- "Non posso dire con certezza, ma X..." + più dettagli su X → X VINCE
- Più vantaggi elencati per X che per Y (es. 3 vs 1) → X VINCE
- X descritto con aggettivi più positivi di Y → X VINCE
- La risposta suggerisce X come prima scelta o raccomandazione → X VINCE
- Usa 0.5 SOLO se il linguaggio è davvero identico per entrambi, senza alcun segnale di preferenza

- first_mention: "A" se Brand A appare per primo nel testo, "B" se Brand B appare per primo, "tie" se nella stessa frase.
- key_arguments: max 3 argomenti principali.

ESEMPI:
- "Entrambi sono ottimi, dipende dalle preferenze" ma 3 vantaggi di ${brandBNorm} e 1 di ${brandANorm} → recommendation: 2
- "${brandANorm} è leader di mercato con ottime recensioni" → recommendation: 1
- "${brandANorm} appare più strutturata e con una presenza più solida online" → recommendation: 1
- "Non ho dati certi, ma ${brandBNorm} sembra più citata nelle fonti" → recommendation: 2
- "Sono intercambiabili, stessa qualità, stesso prezzo" → recommendation: 0.5

Rispondi SOLO con questo JSON:
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
    const { analysisId, brandA, brandB, driver, models: eventModels, language: eventLanguage } = event.data as {
      analysisId: string;
      brandA: string;
      brandB: string;
      driver: string;
      models?: string[];
      language?: string;
    };

    const models = eventModels && eventModels.length > 0 ? eventModels : DEFAULT_MODELS;
    const language = eventLanguage ?? "it";

    // Step 1: Generate queries and create prompt rows
    const queries = generateQueries(brandA, brandB, driver, language);

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

    // Step 2: Execute all prompts (1 per batch to stay under Vercel 60s timeout)
    // GPT-5.4 Responses API takes 23-30s per call — batching multiple would exceed limit
    const batchSize = 1;
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

          const isGpt54 = prompt.model === "gpt-5.4";
          if (isGpt54) console.log(`[GPT-5.4 COMPARISON] Starting call for ${promptId}, query: "${prompt.query_text?.slice(0, 80)}"`);

          try {
            // Prepend language instruction to competitive prompt
            const langInstruction = language === "en"
              ? "IMPORTANT: You MUST respond ONLY in English.\n\n"
              : language === "fr" ? "IMPORTANT: Répondez UNIQUEMENT en français.\n\n"
              : language === "de" ? "IMPORTANT: Antworten Sie NUR auf Deutsch.\n\n"
              : language === "es" ? "IMPORTANT: Responda SOLO en español.\n\n"
              : "IMPORTANT: Rispondi SOLO in italiano.\n\n";
            const promptWithLang = langInstruction + prompt.query_text;

            if (isGpt54) console.log(`[GPT-5.4 COMPARISON] Calling callAIModel(model="${prompt.model}", browsing=true)`);
            const result = await callAIModel(promptWithLang, prompt.model, true);

            if (isGpt54) console.log(`[GPT-5.4 COMPARISON] Result: text_len=${result.text?.length ?? 0}, error=${result.error ?? "none"}, sources=${result.sources?.length ?? 0}`);

            if (!result.text && result.error) {
              console.error(`[competitive] ${prompt.model} failed for ${promptId}: ${result.error}`);
            }

            const updatePayload = {
              response_text: result.text || (result.error ? `ERROR: ${result.error}` : null),
              status: result.text ? "completed" : "error",
            };
            if (isGpt54) console.log(`[GPT-5.4 COMPARISON] DB update: status=${updatePayload.status}, response_text_len=${updatePayload.response_text?.length ?? 0}`);

            const { error: dbErr } = await (supabase.from("competitive_prompts") as any)
              .update(updatePayload)
              .eq("id", promptId);

            if (dbErr) console.error(`[GPT-5.4 COMPARISON] DB update FAILED:`, dbErr.message);
            else if (isGpt54) console.log(`[GPT-5.4 COMPARISON] DB update OK for ${promptId}`);
          } catch (e: any) {
            const errMsg = e?.message ?? String(e);
            console.error(`[GPT-5.4 COMPARISON] EXCEPTION for ${promptId}:`, errMsg);
            const { error: dbErr } = await (supabase.from("competitive_prompts") as any)
              .update({
                response_text: `EXCEPTION: ${errMsg}`,
                status: "error",
              })
              .eq("id", promptId);
            if (dbErr) console.error(`[GPT-5.4 COMPARISON] DB error-update FAILED:`, dbErr.message);
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
          const evaluation = await evaluateResponse(prompt.response_text, brandA, brandB, language);
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

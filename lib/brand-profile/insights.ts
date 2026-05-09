import Anthropic from "@anthropic-ai/sdk";
import { trackedAICall } from "@citationrate/llm-client";
import type { DiagnosticEntry, DiagnosticPillar } from "./cs-bridge";

const SONNET_MODEL = "claude-sonnet-4-5";

/** Optional tracking — flows from inngest.ts so the Sonnet insights call
 * lands in api_call_logs alongside the BP main + extractor calls. */
export interface BpInsightsTracking {
  userId?: string | null;
  runId?: string | null;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export type Pillar = "recognition" | "clarity" | "authority" | "relevance" | "sentiment";

export interface InsightInput {
  brand: string;
  sector: string;
  country: string;
  locale: string;
  scores: {
    recognition: number;
    clarity: number;
    authority: number;
    relevance: number;
    sentiment: number;
  };
  breakdown: any;
  responsesByPillar: Record<Pillar, string[]>;
  diagnostics?: DiagnosticEntry[];
  // Number of distinct AI models that produced the responses (e.g. 2 if the
  // user's plan included claude-haiku + gpt-5.4-mini). Sonnet was previously
  // miscounting "AI" by reading 6 raw responses per pillar (3 prompts × 2
  // models) as 6 AIs. This grounds it.
  modelCount: number;
}

export interface InsightOutput {
  recognition: string[];
  clarity: string[];
  authority: string[];
  relevance: string[];
  sentiment: string[];
}

const LANG_INSTRUCTIONS: Record<string, string> = {
  it: "Rispondi SEMPRE in italiano. Suggerimenti concreti e actionable.",
  en: "ALWAYS respond in English. Concrete actionable suggestions.",
  fr: "Réponds TOUJOURS en français. Conseils concrets et actionnables.",
  de: "Antworte IMMER auf Deutsch. Konkrete, umsetzbare Vorschläge.",
  es: "Responde SIEMPRE en español. Sugerencias concretas y accionables.",
};

const PILLAR_GUIDE: Record<Pillar, string> = {
  recognition:
    "Recognition mide se il brand emerge spontaneamente in liste settoriali. Score basso = AI non ti citano spontaneamente. Suggerisci: PR su tier-1, listicle on-page, citazioni indipendenti, partecipazione a benchmark di settore.",
  clarity:
    "Clarity mide quanti fatti su brand le AI sanno correttamente. Score basso su Factual = AI sbagliano sede/CEO/anno fondazione/settore. Suggerisci: Schema.org Organization, Wikidata QID, Wikipedia, sameAs LinkedIn/Crunchbase, knowledge panel.",
  authority:
    "Authority mide se le AI ti percepiscono come fonte autorevole. Score basso su Tone = ti citano ma neutralmente. Suggerisci: pubblicazione di analisi/ricerche, autori con E-E-A-T, backlink high-authority, mention in articoli tier-1, citazioni accademiche.",
  relevance:
    "Relevance mide se le AI capiscono i tuoi prodotti/servizi reali. Score basso su Product Match = AI ti associano a categorie sbagliate o generiche. Suggerisci: pagine prodotto con Schema Product, descrizioni specifiche, glossario, casi d'uso documentati.",
  sentiment:
    "Sentiment mide se le AI ti raccomandano o parlano positivamente. Score basso su Recommendation = ti citano ma non come prima scelta. Suggerisci: case study pubblici, testimonial verificabili, comparazioni vinte, recensioni high-quality.",
};

function diagnosticsByPillar(diagnostics: DiagnosticEntry[] | undefined): Record<DiagnosticPillar, DiagnosticEntry[]> {
  const acc: Record<DiagnosticPillar, DiagnosticEntry[]> = {
    clarity: [],
    authority: [],
    relevance: [],
  };
  if (!diagnostics) return acc;
  for (const d of diagnostics) {
    if (acc[d.pillar]) acc[d.pillar].push(d);
  }
  return acc;
}

function formatCSFindings(entries: DiagnosticEntry[]): string {
  if (entries.length === 0) return "";
  const fail = entries.filter((e) => e.cs_status === "fail");
  const partial = entries.filter((e) => e.cs_status === "partial");
  const pass = entries.filter((e) => e.cs_status === "pass");
  const fmt = (e: DiagnosticEntry) =>
    `${e.cs_parameter_id}${e.note ? ` "${e.note}"` : ""}`;
  const lines: string[] = [];
  if (fail.length > 0) lines.push(`MANCANTI/ROTTI: ${fail.map(fmt).join("; ")}`);
  if (partial.length > 0) lines.push(`PARZIALI: ${partial.map(fmt).join("; ")}`);
  if (pass.length > 0) lines.push(`OK: ${pass.map(fmt).join("; ")}`);
  return `\n\nAudit Citability del sito (${entries[0].cs_audit_date}):\n${lines.join("\n")}`;
}

function buildPrompt(input: InsightInput): string {
  const lang = LANG_INSTRUCTIONS[input.locale] ?? LANG_INSTRUCTIONS.it;
  const csByPillar = diagnosticsByPillar(input.diagnostics);
  const hasCS = (input.diagnostics?.length ?? 0) > 0;

  const pillarBlocks = (Object.keys(input.responsesByPillar) as Pillar[])
    .map((p) => {
      const score = input.scores[p];
      const breakdown = input.breakdown?.[p]
        ? JSON.stringify(input.breakdown[p])
        : "n/d";
      const responses = input.responsesByPillar[p]
        .map((r, i) => `[Risposta ${i + 1}]\n${r.slice(0, 1500)}`)
        .join("\n\n");
      const csBlock =
        p === "clarity" || p === "authority" || p === "relevance"
          ? formatCSFindings(csByPillar[p])
          : "";
      return `## ${p.toUpperCase()} — score ${Math.round(score)}/100\nGuida: ${PILLAR_GUIDE[p]}\nBreakdown: ${breakdown}${csBlock}\n\nRisposte AI raccolte:\n${responses}`;
    })
    .join("\n\n---\n\n");

  const csRule = hasCS
    ? `\n- Il sito è già stato auditato con Citability: usa i parametri MANCANTI/ROTTI come spiegazione causale, MA NON CITARE MAI il codice del parametro (es. "P5", "P10") né il nome tecnico del parametro nel testo dell'insight. Descrivi la causa in linguaggio piano (es. "manca markup Schema.org Product sulle pagine prodotto") e suggerisci la riparazione concreta.`
    : "";

  const responsesPerPillar = input.responsesByPillar.recognition.length;
  const modelCountLine = `\nContesto setup: ${input.modelCount} modello/i AI distinti, 3 prompt per pilastro = ${responsesPerPillar} risposte per pilastro. NON dire "${responsesPerPillar} AI" leggendo il numero di risposte: i modelli AI distinti sono ${input.modelCount}, mai più. Riferisciti alle risposte come "le risposte AI" o "i modelli", mai "${responsesPerPillar} AI".`;

  return `${lang}

Sei un consulente di brand visibility AI. Analizza queste risposte di modelli AI sul brand "${input.brand}" (settore: ${input.sector}, paese: ${input.country}) e per OGNI pilastro produci 2-3 raccomandazioni MOLTO CONCRETE e actionable.${modelCountLine}

REGOLE:
- Niente generiche tipo "migliora il SEO". Cita la causa specifica trovata nelle risposte AI.
- Se le AI confondono il brand con un altro, dillo esplicitamente.
- Se score è alto (>70) suggerisci come consolidare; se basso (<50) suggerisci come riparare.
- Massimo 240 caratteri per ogni insight.
- VIETATO citare istituzioni accademiche, osservatori, atenei o università generici (es. Politecnico Milano, Università Bocconi, Osservatorio Digital Innovation) come azione consigliata, A MENO CHE il brand operi davvero in quel mondo o ci sia un legame esplicito visibile nelle risposte AI raccolte. Per la maggior parte dei brand sono suggerimenti irrealistici e non actionable: preferisci azioni che il brand può eseguire da solo (PR su testate di settore vere, contenuti propri, partnership di prodotto).
- VIETATO citare codici tecnici di parametri (P1, P5, P10, P49 ecc.) o nomi tecnici interni nel testo dell'insight. L'utente vede solo il testo finale; usa linguaggio business-friendly.${csRule}

${pillarBlocks}

Rispondi SOLO con un JSON object di questa forma:
{
  "recognition": ["insight 1", "insight 2", "insight 3"],
  "clarity": ["insight 1", "insight 2"],
  "authority": [...],
  "relevance": [...],
  "sentiment": [...]
}

Niente preamboli, niente markdown, solo JSON valido.`;
}

export async function generateInsights(
  input: InsightInput,
  tracking?: BpInsightsTracking,
): Promise<{
  insights: InsightOutput;
  model: string;
}> {
  const prompt = buildPrompt(input);
  const c = client();
  const resp = await trackedAICall(
    {
      product: "brand_profile" as const,
      operation: "bp_insights",
      provider: "anthropic" as const,
      apiModel: SONNET_MODEL,
      userId: tracking?.userId ?? null,
      runId: tracking?.runId ?? null,
    },
    () => c.messages.create({
      model: SONNET_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  );

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text as string)
    .join("\n");

  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Best-effort recovery: find the first { and last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } else {
      throw new Error("Insight JSON parse failed");
    }
  }

  const sanitize = (arr: any): string[] =>
    Array.isArray(arr)
      ? arr.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => String(s).slice(0, 280))
      : [];

  return {
    insights: {
      recognition: sanitize(parsed.recognition),
      clarity: sanitize(parsed.clarity),
      authority: sanitize(parsed.authority),
      relevance: sanitize(parsed.relevance),
      sentiment: sanitize(parsed.sentiment),
    },
    model: SONNET_MODEL,
  };
}

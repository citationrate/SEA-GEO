import Anthropic from "@anthropic-ai/sdk";
import { trackedAICall } from "@citationrate/llm-client";
import type { DiagnosticEntry, DiagnosticPillar } from "./cs-bridge";

// Switched from Sonnet 4.5 to Haiku 4.5 (May 2026): Sonnet was generating
// over-articulated insights with paragraph-length reasoning that we then
// truncated to 600 chars — most of the cost was being thrown away. Haiku 4.5
// produces tighter, equally on-point bullets at ~80% of the quality at 20%
// of the cost ($0.08 → ~$0.02, −$0.06 per run / −10% of total).
//
// The original Sonnet was also tone-deaf to the "vague qualifiers, no
// numbers" rule and constantly leaked "score 68/100" or "8/10 responses"
// into the insight text. Haiku, being more instruction-following on short
// system prompts, respects the constraint more consistently in tests.
const INSIGHTS_MODEL = "claude-haiku-4-5-20251001";

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

// Qualitative level conversion — keeps Sonnet/Haiku from leaking the raw
// numeric score into the insight text. The model receives "livello: alto"
// instead of "score 84/100", so it physically can't write "Score 84/100…"
// at the start of an insight (which was the dominant leak mode pre-May 2026).
function scoreLevel(score: number): string {
  if (score >= 85) return "eccellente";
  if (score >= 70) return "alto";
  if (score >= 50) return "medio-alto";
  if (score >= 30) return "medio-basso";
  return "basso";
}

// Generic breakdown sub-metric → qualitative bucket. Most sub-metrics in
// the BP scoring sit on a 0-100 scale (presence, position, tone, factual,
// product_match, etc.), so a single bucket function covers all of them.
function subMetricLevel(value: number): string {
  if (value >= 75) return "forte";
  if (value >= 55) return "discreto";
  if (value >= 35) return "debole";
  return "molto debole";
}

// Build a human-readable summary of the pillar breakdown without leaking
// individual numeric values. Each pillar has known sub-metric keys; we map
// them to phrases and join. Falls back to a generic summary if the
// breakdown shape is unexpected.
function describeBreakdown(pillar: Pillar, breakdown: any): string {
  if (!breakdown) return "";
  const phrases: string[] = [];
  const fmt = (label: string, v: any) => {
    if (typeof v === "number" && !isNaN(v)) {
      phrases.push(`${label} ${subMetricLevel(v)}`);
    }
  };
  switch (pillar) {
    case "recognition":
      fmt("presenza spontanea", breakdown.presence);
      fmt("posizione in classifica", breakdown.position);
      break;
    case "clarity":
      fmt("accuratezza fattuale", breakdown.factual);
      fmt("assenza di confusione", breakdown.no_confusion);
      break;
    case "authority":
      fmt("citazione come esperto", breakdown.presence);
      fmt("tono autorevole", breakdown.tone);
      break;
    case "relevance":
      fmt("riconoscimento dei prodotti", breakdown.product_match);
      fmt("coerenza con il settore", breakdown.coherence);
      break;
    case "sentiment":
      fmt("sentiment", breakdown.sentiment);
      fmt("raccomandazione", breakdown.recommendation);
      fmt("calore del tono", breakdown.tone);
      break;
  }
  return phrases.length > 0 ? phrases.join(", ") : "";
}

// Sample N representative responses out of the full set instead of dumping
// all 10. Three benefits: (1) Sonnet/Haiku can't reverse-engineer "N/M
// citations" counts from a subset, (2) input tokens drop ~70% → cheaper
// insights call, (3) the qualitative signal is preserved because we pick
// evenly-spaced samples across the response array.
function sampleResponses(all: string[], n: number = 3): string[] {
  if (all.length <= n) return all;
  // Pick evenly-spaced indices: e.g. for 10 responses with n=3 → [0, 5, 9]
  const step = (all.length - 1) / (n - 1);
  const indices = Array.from({ length: n }, (_, i) => Math.round(i * step));
  return indices.map((i) => all[i]);
}

function buildPrompt(input: InsightInput): string {
  const lang = LANG_INSTRUCTIONS[input.locale] ?? LANG_INSTRUCTIONS.it;
  const csByPillar = diagnosticsByPillar(input.diagnostics);
  const hasCS = (input.diagnostics?.length ?? 0) > 0;

  const pillarBlocks = (Object.keys(input.responsesByPillar) as Pillar[])
    .map((p) => {
      const level = scoreLevel(input.scores[p]);
      const breakdownDesc = describeBreakdown(p, input.breakdown?.[p]);
      // Show only 3 evenly-spaced response samples instead of all 10 —
      // prevents counting attacks ("N modelli su M") and saves tokens.
      const samples = sampleResponses(input.responsesByPillar[p], 3);
      const responses = samples
        .map((r, i) => `[Esempio risposta AI ${i + 1}]\n${r.slice(0, 1200)}`)
        .join("\n\n");
      const csBlock =
        p === "clarity" || p === "authority" || p === "relevance"
          ? formatCSFindings(csByPillar[p])
          : "";
      return `## ${p.toUpperCase()} — livello: ${level}\nGuida: ${PILLAR_GUIDE[p]}${breakdownDesc ? `\nQualità interna: ${breakdownDesc}` : ""}${csBlock}\n\nEsempi rappresentativi di risposte AI:\n${responses}`;
    })
    .join("\n\n---\n\n");

  const csRule = hasCS
    ? `\n- Il sito è già stato auditato con Citability: usa i parametri MANCANTI/ROTTI come spiegazione causale, MA NON CITARE MAI il codice del parametro (es. "P5", "P10") né il nome tecnico del parametro nel testo dell'insight. Descrivi la causa in linguaggio piano (es. "manca markup Schema.org Product sulle pagine prodotto") e suggerisci la riparazione concreta.`
    : "";

  return `${lang}

Sei un consulente di brand visibility AI. Analizza queste informazioni qualitative sul brand "${input.brand}" (settore: ${input.sector}, paese: ${input.country}) e per OGNI pilastro produci 2-3 raccomandazioni MOLTO CONCRETE e actionable.

REGOLE QUANTITATIVE — VINCOLANTI E NON NEGOZIABILI:
- VIETATO citare numeri esatti di qualsiasi tipo nel testo dell'insight:
  · Niente score numerici (es. "score 68/100", "score 87", "punteggio 73")
  · Niente percentuali (es. "100%", "70%", "presenza 25%")
  · Niente conteggi di risposte AI (es. "8/10 risposte", "5 modelli su 10", "in 2 risposte", "tutte le AI", "metà delle AI")
  · Niente valori di breakdown (es. "tono 72.7", "presence 11", "recommendation 77.3")
  · Niente numero di modelli usati (es. "i 5 modelli", "tutti i motori AI")
  · Niente posizioni numeriche specifiche (es. "posizione #1", "in decima posizione", "quarto posto")
- USA SOLO qualificatori VAGHI ma utili:
  · "spesso", "raramente", "occasionalmente", "talvolta"
  · "la maggior parte delle volte", "in alcune risposte", "quasi sempre"
  · "in modo costante", "in modo sporadico", "diffusamente"
  · "presenza forte/discreta/debole", "tono autorevole/neutro/incerto"
  · "in posizione di vertice", "in fondo alla classifica", "in coda alle liste"
  · "primo brand citato", "tra i primi citati", "in fondo all'elenco" (ordinale generico OK, numerico vietato)

REGOLE DI MERITO:
- Niente generiche tipo "migliora il SEO". Cita la causa specifica trovata negli esempi di risposte AI.
- Se le AI confondono il brand con un altro, dillo esplicitamente.
- Se il livello è alto/eccellente suggerisci come consolidare; se basso/medio-basso suggerisci come riparare.
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
      apiModel: INSIGHTS_MODEL,
      userId: tracking?.userId ?? null,
      runId: tracking?.runId ?? null,
    },
    () => c.messages.create({
      model: INSIGHTS_MODEL,
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

  // Cap each bullet at ~600 chars to avoid pathological Sonnet outputs.
  // Truncate at word boundary instead of mid-word (the previous 280-char
  // slice produced bullets like "...più vendute in Ital" or "...con descri"
  // because Sonnet wrote up to ~400-450 chars and the slice cut on a code
  // unit, not a token). The UI shows a "...altro" toggle so the user can
  // still read the long ones expanded.
  const truncateAtWord = (s: string, max: number): string => {
    if (s.length <= max) return s;
    const sliced = s.slice(0, max);
    const lastSpace = sliced.lastIndexOf(" ");
    return (lastSpace > max * 0.7 ? sliced.slice(0, lastSpace) : sliced).trimEnd();
  };
  const sanitize = (arr: any): string[] =>
    Array.isArray(arr)
      ? arr
          .filter((s) => typeof s === "string" && s.trim().length > 0)
          .map((s) => truncateAtWord(String(s).trim(), 600))
      : [];

  return {
    insights: {
      recognition: sanitize(parsed.recognition),
      clarity: sanitize(parsed.clarity),
      authority: sanitize(parsed.authority),
      relevance: sanitize(parsed.relevance),
      sentiment: sanitize(parsed.sentiment),
    },
    model: INSIGHTS_MODEL,
  };
}

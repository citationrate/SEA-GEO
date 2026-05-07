import Anthropic from "@anthropic-ai/sdk";

const SONNET_MODEL = "claude-sonnet-4-5";

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

function buildPrompt(input: InsightInput): string {
  const lang = LANG_INSTRUCTIONS[input.locale] ?? LANG_INSTRUCTIONS.it;
  const pillarBlocks = (Object.keys(input.responsesByPillar) as Pillar[])
    .map((p) => {
      const score = input.scores[p];
      const breakdown = input.breakdown?.[p]
        ? JSON.stringify(input.breakdown[p])
        : "n/d";
      const responses = input.responsesByPillar[p]
        .map((r, i) => `[Risposta ${i + 1}]\n${r.slice(0, 1500)}`)
        .join("\n\n");
      return `## ${p.toUpperCase()} — score ${Math.round(score)}/100\nGuida: ${PILLAR_GUIDE[p]}\nBreakdown: ${breakdown}\n\nRisposte AI raccolte:\n${responses}`;
    })
    .join("\n\n---\n\n");

  return `${lang}

Sei un consulente di brand visibility AI. Analizza queste risposte di modelli AI sul brand "${input.brand}" (settore: ${input.sector}, paese: ${input.country}) e per OGNI pilastro produci 2-3 raccomandazioni MOLTO CONCRETE e actionable.

REGOLE:
- Niente generiche tipo "migliora il SEO". Cita la causa specifica trovata nelle risposte AI.
- Se le AI confondono il brand con un altro, dillo esplicitamente.
- Se score è alto (>70) suggerisci come consolidare; se basso (<50) suggerisci come riparare.
- Massimo 240 caratteri per ogni insight.

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

export async function generateInsights(input: InsightInput): Promise<{
  insights: InsightOutput;
  model: string;
}> {
  const prompt = buildPrompt(input);
  const c = client();
  const resp = await c.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

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

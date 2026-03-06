import OpenAI from "openai";

export interface ExtractionResult {
  brand_mentioned: boolean;
  brand_rank: number | null;
  brand_occurrences: number;
  sentiment_score: number | null;
  topics: string[];
  competitors_found: string[];
  sources: {
    url: string | null;
    domain: string | null;
    label: string | null;
    source_type: "explicit" | "mentioned" | "inferred" | "none";
    is_brand_owned: boolean;
  }[];
}

export async function extractFromResponse(
  response: string,
  targetBrand: string,
  knownCompetitors: string[]
): Promise<ExtractionResult> {
  const systemPrompt = `Sei un analista AI. Analizza la risposta di un modello AI ed estrai dati strutturati.

Il brand target è: "${targetBrand}"
Competitor conosciuti: ${knownCompetitors.length > 0 ? knownCompetitors.join(", ") : "nessuno specificato"}

Rispondi SOLO con JSON valido, senza markdown o testo aggiuntivo.

Schema JSON richiesto:
{
  "brand_mentioned": boolean,
  "brand_rank": number | null,
  "brand_occurrences": number,
  "sentiment_score": number | null,
  "topics": string[],
  "competitors_found": string[],
  "sources": [{ "url": string|null, "domain": string|null, "label": string|null, "source_type": "explicit"|"mentioned"|"inferred"|"none", "is_brand_owned": boolean }]
}

Regole:
- brand_mentioned: true se il brand target appare nella risposta
- brand_rank: posizione del brand se c'è una lista/classifica (1=primo), null se non c'è lista
- brand_occurrences: numero di volte che il brand appare nel testo
- sentiment_score: da -1.0 (molto negativo) a 1.0 (molto positivo) verso il brand, null se non menzionato
- topics: argomenti principali trattati nella risposta (max 5)
- competitors_found: tutti i brand/prodotti concorrenti menzionati (escluso il target)
- sources: URL, domini o fonti citate nella risposta`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analizza questa risposta:\n\n${response}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      brand_mentioned: Boolean(parsed.brand_mentioned),
      brand_rank: parsed.brand_rank ?? null,
      brand_occurrences: Number(parsed.brand_occurrences) || 0,
      sentiment_score: parsed.sentiment_score ?? null,
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      competitors_found: Array.isArray(parsed.competitors_found) ? parsed.competitors_found : [],
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.map((s: any) => ({
            url: s.url ?? null,
            domain: s.domain ?? null,
            label: s.label ?? null,
            source_type: ["explicit", "mentioned", "inferred", "none"].includes(s.source_type) ? s.source_type : "none",
            is_brand_owned: Boolean(s.is_brand_owned),
          }))
        : [],
    };
  } catch {
    return {
      brand_mentioned: false,
      brand_rank: null,
      brand_occurrences: 0,
      sentiment_score: null,
      topics: [],
      competitors_found: [],
      sources: [],
    };
  }
}

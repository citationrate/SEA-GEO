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
    source_type: "brand_owned" | "competitor" | "media" | "review" | "social" | "ecommerce" | "wikipedia" | "other";
    is_brand_owned: boolean;
    context: string | null;
  }[];
}

const VALID_SOURCE_TYPES = ["brand_owned", "competitor", "media", "review", "social", "ecommerce", "wikipedia", "other"];

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
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

Regole:
- brand_mentioned: true se il brand target appare nella risposta
- brand_rank: posizione del brand se c'è una lista/classifica (1=primo), null se non c'è lista
- brand_occurrences: numero di volte che il brand appare nel testo
- sentiment_score: da -1.0 (molto negativo) a 1.0 (molto positivo) verso il brand, null se non menzionato
- topics: argomenti principali trattati nella risposta (max 5)
- competitors_found: brand/aziende concorrenti menzionati (escluso il target)

REGOLE PER LE FONTI (sources):
- Estrai TUTTI gli URL e domini citati nella risposta, anche se solo menzionati come riferimento
- url: l'URL completo se presente, altrimenti null
- domain: SEMPRE il dominio pulito (es. nike.com, wikipedia.org, trustpilot.com). MAI vuoto.
- source_type: classifica tra:
  * "brand_owned" = sito ufficiale del brand "${targetBrand}"
  * "competitor" = sito di un competitor
  * "media" = giornali, riviste, blog, testate giornalistiche
  * "review" = siti di recensioni (trustpilot, amazon reviews, tripadvisor ecc)
  * "social" = social media (instagram, youtube, tiktok, twitter, facebook, linkedin ecc)
  * "ecommerce" = shop online (amazon, ebay, zalando ecc)
  * "wikipedia" = wikipedia in qualsiasi lingua
  * "other" = tutto il resto
- is_brand_owned: true solo se è il sito ufficiale del brand target
- context: una frase breve che spiega in che contesto è stata citata questa fonte nella risposta

REGOLE ASSOLUTE per i competitor:
- Estrai SOLO brand/aziende, MAI prodotti specifici o modelli
- Se vedi "Brand + Prodotto" (es. "Adidas Ultraboost", "Nike Air Max 90", "Apple iPhone"), estrai SOLO il brand ("Adidas", "Nike", "Apple")
- Regola: se il nome contiene un numero, una versione, o un nome di modello dopo il brand → tieni solo il brand
- NON estrarre il brand target "${targetBrand}" come competitor di se stesso
- MAI estrarre descrizioni generiche come "scarpe da running", "brand sportivo", "competitor locale"
- Il competitor deve essere un'azienda reale e identificabile`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
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
            source_type: VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other",
            is_brand_owned: Boolean(s.is_brand_owned),
            context: s.context ?? null,
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

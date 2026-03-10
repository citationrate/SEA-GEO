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

FONTI: Estrai TUTTI i siti web, domini, URL, blog, riviste, piattaforme citati o menzionati nella risposta, anche implicitamente.
Esempi: se dice 'secondo Gambero Rosso' → estrai 'gamberorosso.it', se dice 'disponibile su Amazon' → estrai 'amazon.it', se dice 'recensioni su Trustpilot' → estrai 'trustpilot.com'.
Se la risposta cita categorie di siti senza nominarli esplicitamente (es. 'siti di recensioni', 'e-commerce'), estrai i domini più probabili per quel contesto.
Restituisci array di oggetti: [{url: 'dominio.com', domain: 'dominio.com', label: null, source_type: 'media|review|ecommerce|social|brand_owned|competitor|wikipedia|other', is_brand_owned: boolean, context: 'breve spiegazione'}]
Se non ci sono fonti restituisci [].

REGOLE per competitors_found:
Estrai tutti i brand, aziende, insegne o entità commerciali che compaiono come alternative al brand principale.

INCLUDI: qualsiasi entità con un nome proprio specifico — supermercati, distributori, e-commerce, produttori artigianali con nome proprio, catene, marketplace. Esempi: "Esselunga", "Coop", "Biscottificio Artigianale Rossi", "Penny Market", "NaturaSì".

ESCLUDI:
- Descrizioni generiche senza nome proprio ("biscottificio artigianale", "produttore locale", "negozio di quartiere", "brand sportivo", "competitor locale")
- Entità che non hanno un nome che un utente potrebbe cercare su Google
- Il brand target "${targetBrand}"

FORMATO:
- Restituisci SOLO il nome commerciale (es. "Esselunga", non "Esselunga è un supermercato")
- Se vedi "Brand + Prodotto" (es. "Nike Air Max 90"), estrai SOLO il brand ("Nike")
- Se non sei sicuro del nome esatto, usa il nome più comunemente conosciuto
- Array di stringhe: ["Esselunga", "Coop", "Lidl"]`;

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
    console.log("Sources extracted:", JSON.stringify(parsed.sources));
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

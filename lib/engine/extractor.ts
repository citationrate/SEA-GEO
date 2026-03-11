import OpenAI from "openai";

export interface ExtractionResult {
  brand_mentioned: boolean;
  brand_rank: number | null;
  brand_occurrences: number;
  sentiment_score: number | null;
  tone_score: number | null;
  position_score: number | null;
  recommendation_score: number | null;
  brand_adjectives: string[];
  topics: string[];
  competitors_found: {
    name: string;
    rank: number | null;
    sentiment: number | null;
    recommendation: number | null;
  }[];
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

function positionScore(rank: number | null, nCompetitors: number): number {
  if (!rank || rank === 0) return 0.5; // presente ma non classificabile
  if (nCompetitors === 0) return 0.7;  // unico citato, nessun confronto
  return Math.max(0, 1 - ((rank - 1) / nCompetitors));
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
  "competitors_count": number,
  "tone_score": number,
  "recommendation_score": number,
  "brand_adjectives": string[],
  "topics": string[],
  "competitors_found": [{ "name": string, "rank": number, "sentiment": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

Regole:
- brand_mentioned: true se il brand target appare nella risposta
- brand_rank: posizione in cui il brand appare nella risposta rispetto ad altri brand/alternative.
  1 = citato per primo o come principale raccomandazione.
  2 = citato come seconda opzione.
  3+ = citato dopo altri brand.
  null = SOLO se brand_mentioned è false.
  IMPORTANTE: Se brand_mentioned è true, brand_rank NON può essere null. Anche se non c'è una lista esplicita, valuta l'ordine in cui il brand appare rispetto ai concorrenti (1 se è il primo o unico citato).
- brand_occurrences: numero di volte che il brand appare nel testo
- competitors_count: quanti competitor totali sono citati nella risposta (NON includere il brand target)
- tone_score: Analizza il linguaggio specifico usato per descrivere il brand.
  Identifica prima 2-3 aggettivi o frasi chiave, poi assegna il score.
  Esempi concreti:
  - 'iconico, amatissimo, eccellente qualità' → +0.8
  - 'buono, affidabile, valido' → +0.5
  - 'conosciuto, disponibile, tra i più venduti' → +0.2
  - 'nella media, non particolarmente distintivo' → -0.1
  - 'criticato, controverso, problematico' → -0.6
  - 'sconsigliato, di bassa qualità' → -0.9
  IMPORTANTE:
  - Usa l'intera scala da -1.0 a +1.0 con granularità 0.1
  - NON usare 0.5 come default — ragiona sul testo
  - Se il brand non è descritto con aggettivi specifici usa 0.2 (neutro-positivo) o 0.0 (puramente neutro)
  - 0.5 è riservato a linguaggio genuinamente positivo con aggettivi chiari
  Se brand_mentioned è false, usa 0.0.
- brand_adjectives: elenca 2-3 aggettivi/frasi chiave usati per descrivere il brand. Array vuoto se brand_mentioned è false.
- recommendation_score: L'AI raccomanda esplicitamente il brand?
  +1.0 = raccomandato esplicitamente come prima/unica scelta
  +0.5 = citato positivamente, dipende dal caso
  0.0 = non esprime raccomandazione
  -0.5 = sconsigliato con riserve
  -1.0 = sconsigliato esplicitamente
  Se brand_mentioned è false, usa 0.0.
- topics: argomenti principali trattati nella risposta (max 5)
- competitors_found: per ogni competitor trovato estrai:
  - name: nome del brand
  - rank: posizione in cui appare nella risposta (1=primo citato)
  - sentiment: tono con cui l'AI descrive il competitor (-1.0/+1.0)
  - recommendation: l'AI lo raccomanda? (+1=sì, 0=neutro, -1=sconsigliato)
  Stesse regole del tone_score per granularità e no-default-0.5.

REGOLA CRITICA: Se brand_mentioned è true, brand_rank, tone_score e recommendation_score sono OBBLIGATORI e non possono essere null.

FONTI: Estrai TUTTI i siti web, domini, URL, blog, riviste, piattaforme citati o menzionati nella risposta, anche implicitamente.
Esempi: se dice 'secondo Gambero Rosso' → estrai 'gamberorosso.it', se dice 'disponibile su Amazon' → estrai 'amazon.it', se dice 'recensioni su Trustpilot' → estrai 'trustpilot.com'.
Se la risposta cita categorie di siti senza nominarli esplicitamente (es. 'siti di recensioni', 'e-commerce'), estrai i domini più probabili per quel contesto.
Restituisci array di oggetti: [{url: 'dominio.com', domain: 'dominio.com', label: null, source_type: 'media|review|ecommerce|social|brand_owned|competitor|wikipedia|other', is_brand_owned: boolean, context: 'breve spiegazione'}]
Se non ci sono fonti restituisci [].

REGOLE per competitors_found:
Estrai tutti i brand, aziende, insegne o entità commerciali che compaiono come alternative al brand principale.

INCLUDI: qualsiasi entità con un nome proprio specifico — supermercati, distributori, e-commerce, produttori artigianali con nome proprio, catene, marketplace. Esempi: "Esselunga", "Coop", "Biscottificio Artigianale Rossi", "Penny Market", "NaturaSì".

ESCLUDI ASSOLUTAMENTE:
- Varianti, linee di prodotto o sub-brand del brand target.
  Esempi: se target è 'Coca-Cola', escludi 'Coca-Cola Zero', 'Coca-Cola Light', 'Coca-Cola Cherry', 'Coca-Cola Vanilla'.
  Se target è 'Pepsi', escludi 'Pepsi Max', 'Pepsi Light', 'Pepsi Zero'.
- Prodotti dello stesso gruppo aziendale del brand target
- Il brand target "${targetBrand}" stesso in qualsiasi forma
- Descrizioni generiche senza nome proprio ("biscottificio artigianale", "produttore locale", "negozio di quartiere", "brand sportivo", "competitor locale")
- Entità che non hanno un nome che un utente potrebbe cercare su Google

INCLUDI solo brand/aziende completamente distinte dal target.

FORMATO:
- Restituisci SOLO il nome commerciale (es. "Esselunga", non "Esselunga è un supermercato")
- Se vedi "Brand + Prodotto" (es. "Nike Air Max 90"), estrai SOLO il brand ("Nike")
- Se non sei sicuro del nome esatto, usa il nome più comunemente conosciuto
- Array di oggetti: [{"name": "Esselunga", "rank": 1, "sentiment": 0.6, "recommendation": 0.5}]`;

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
    console.log("[extractor] result:", JSON.stringify(parsed));

    const brandMentioned = Boolean(parsed.brand_mentioned);

    // Enforce brand_rank when brand is mentioned
    let brandRank: number | null = parsed.brand_rank != null ? Number(parsed.brand_rank) : null;

    if (brandMentioned) {
      if (brandRank == null) {
        console.log("[extractor] WARN: brand_mentioned=true but brand_rank is null, defaulting to 1");
        brandRank = 1;
      }
    }

    // Multidimensional sentiment
    const toneScore = parsed.tone_score ?? 0;
    const posScore = positionScore(brandRank, parsed.competitors_count ?? 0);
    const recScore = parsed.recommendation_score ?? 0;

    // Formula pesata con recommendation come componente additiva
    const base = (toneScore * 0.3) + (posScore * 0.5) + (recScore * 0.2);
    const sentimentFinal = Math.max(-1, Math.min(1, base)); // clamp -1/+1

    console.log("[extractor] sentiment breakdown:", {
      tone: toneScore,
      position: posScore,
      recommendation: recScore,
      final: sentimentFinal,
      adjectives: Array.isArray(parsed.brand_adjectives) ? parsed.brand_adjectives : [],
    });

    return {
      brand_mentioned: brandMentioned,
      brand_rank: brandRank,
      brand_occurrences: Number(parsed.brand_occurrences) || 0,
      sentiment_score: sentimentFinal,
      tone_score: toneScore,
      position_score: posScore,
      recommendation_score: recScore,
      brand_adjectives: Array.isArray(parsed.brand_adjectives) ? parsed.brand_adjectives : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      competitors_found: (() => {
        const competitorsRaw = Array.isArray(parsed.competitors_found) ? parsed.competitors_found : [];
        return competitorsRaw.map((c: any) =>
          typeof c === 'string'
            ? { name: c, rank: null, sentiment: null, recommendation: null }
            : { name: c.name, rank: c.rank ?? null, sentiment: c.sentiment ?? null, recommendation: c.recommendation ?? null }
        );
      })(),
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
      tone_score: null,
      position_score: null,
      recommendation_score: null,
      brand_adjectives: [],
      topics: [],
      competitors_found: [] as ExtractionResult["competitors_found"],
      sources: [],
    };
  }
}

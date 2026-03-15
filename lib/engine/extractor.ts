import Anthropic from "@anthropic-ai/sdk";
import { canonicalizeCompetitorName } from "./competitor-names";

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
    type: "direct" | "indirect" | "channel" | "aggregator";
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

/* ─── Brand mention detection ─── */

/** Strip accents: "Caffè" → "Caffe", "Ménard" → "Menard" */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Escape a string for use inside a RegExp */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build brand name variants for matching:
 * - Full name as-is
 * - Full name with accents stripped
 * - First distinctive word (for multi-word brands like "Costa Crociere" → "Costa")
 * - Common international swaps (Crociere↔Cruises, Gruppo↔Group, etc.)
 */
function buildBrandVariants(brand: string): string[] {
  const variants = new Set<string>();

  const clean = brand.trim();
  if (!clean) return [];

  // Full name
  variants.add(clean.toLowerCase());
  variants.add(stripAccents(clean).toLowerCase());

  // International name swaps (Italian ↔ English)
  const swaps: [RegExp, string][] = [
    [/\bCrociere\b/i, "Cruises"],
    [/\bCruises\b/i, "Crociere"],
    [/\bGruppo\b/i, "Group"],
    [/\bGroup\b/i, "Gruppo"],
    [/\bAssicurazioni\b/i, "Insurance"],
    [/\bInsurance\b/i, "Assicurazioni"],
    [/\bEnergia\b/i, "Energy"],
    [/\bEnergy\b/i, "Energia"],
    [/\bAlimentari\b/i, "Foods"],
    [/\bFoods\b/i, "Alimentari"],
  ];
  for (const [pattern, replacement] of swaps) {
    if (pattern.test(clean)) {
      variants.add(clean.replace(pattern, replacement).toLowerCase());
    }
  }

  // First distinctive word for multi-word brands
  // Skip generic prefixes that shouldn't match alone
  const GENERIC_WORDS = new Set([
    "il", "la", "le", "lo", "i", "gli", "un", "una", "the", "a", "an",
    "di", "del", "della", "dei", "delle", "of", "de",
    "san", "saint", "new", "old", "gran", "grande", "big",
    "gruppo", "group", "società", "company", "brand",
  ]);

  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    const firstWord = words[0];
    // Only use first word if it's distinctive enough (>= 3 chars, not generic)
    if (firstWord.length >= 3 && !GENERIC_WORDS.has(firstWord.toLowerCase())) {
      variants.add(firstWord.toLowerCase());
      variants.add(stripAccents(firstWord).toLowerCase());
    }
  }

  // Handle "&" / "and" / "e" variations: "Dolce & Gabbana" ↔ "Dolce and Gabbana"
  if (clean.includes("&")) {
    variants.add(clean.replace(/\s*&\s*/g, " and ").toLowerCase());
    variants.add(clean.replace(/\s*&\s*/g, " e ").toLowerCase());
  }
  if (/\band\b/i.test(clean)) {
    variants.add(clean.replace(/\band\b/gi, "&").toLowerCase());
  }

  return Array.from(variants);
}

interface BrandDetection {
  mentioned: boolean;
  occurrences: number;
  matchedVariant: string | null;
}

/** Strip markdown formatting: **bold**, *italic*, _underline_, `code`, [links](url) */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")     // **bold**
    .replace(/\*(.+?)\*/g, "$1")          // *italic*
    .replace(/__(.+?)__/g, "$1")          // __underline__
    .replace(/_(.+?)_/g, "$1")            // _italic_
    .replace(/`(.+?)`/g, "$1")            // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url)
    .replace(/#{1,6}\s/g, "");            // # headings
}

/**
 * Detect brand mentions using multiple strategies:
 * 1. Exact full-name match (case-insensitive, accent-insensitive)
 * 2. International name variations
 * 3. First-word partial match (for multi-word brands)
 *
 * Strips markdown formatting before comparison to handle
 * bold/italic brand names (e.g. **Lattebusche**).
 */
function detectBrandMention(response: string, targetBrand: string): BrandDetection {
  const cleaned = stripMarkdown(response);
  const responseLower = cleaned.toLowerCase();
  const responseNorm = stripAccents(responseLower);
  const variants = buildBrandVariants(targetBrand);

  // Try full-name variants first (higher confidence), then partial
  // Sort: longer variants first (full name before first-word)
  const sorted = variants.sort((a, b) => b.length - a.length);

  for (const variant of sorted) {
    const variantNorm = stripAccents(variant);
    // Use word-boundary matching to avoid false positives
    // e.g. "Costa" should match "Costa" but not "Costabile"
    const pattern = new RegExp(`\\b${escapeRegex(variantNorm)}\\b`, "gi");
    const matches = responseNorm.match(pattern);
    if (matches && matches.length > 0) {
      return { mentioned: true, occurrences: matches.length, matchedVariant: variant };
    }
  }

  return { mentioned: false, occurrences: 0, matchedVariant: null };
}

function positionScore(rank: number | null, nCompetitors: number): number {
  if (!rank || rank === 0) return 0.5; // presente ma non classificabile
  if (nCompetitors === 0) return 0.7;  // unico citato, nessun confronto
  return Math.max(0, 1 - ((rank - 1) / nCompetitors));
}

async function extractCompetitorsTopicsSources(
  response: string,
  targetBrand: string,
  knownCompetitors: string[],
  sector?: string,
  brandType?: string,
): Promise<Pick<ExtractionResult, "topics" | "competitors_found" | "sources">> {
  // Clean control characters that may break Claude parsing
  const cleanResponse = response
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();

  if (!cleanResponse || cleanResponse.length < 50) {
    return { topics: [], competitors_found: [], sources: [] };
  }

  const prompt = `Sei un analista AI. Il brand "${targetBrand}" NON è presente in questa risposta.
Settore: ${sector ?? "generico"}
Tipo brand: ${brandType ?? "manufacturer"}
Competitor conosciuti: ${knownCompetitors.length > 0 ? knownCompetitors.join(", ") : "nessuno specificato"}

Estrai comunque:
- competitors_found: max 3 brand più rilevanti citati, con tipo competitivo
- topics: max 3 argomenti principali trattati
- sources: max 3 siti/domini più rilevanti citati

Rispondi SOLO con JSON valido. Max 3 competitor, max 3 topic, max 3 fonti. Nessun testo prima o dopo il JSON.

Schema JSON richiesto:
{
  "topics": string[],
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

TIPI COMPETITOR:
- direct: stesso prodotto/servizio, stesso mercato
- indirect: prodotto diverso, soddisfa lo stesso bisogno
- channel: canali che vendono/distribuiscono al posto del brand
- aggregator: piattaforme che confrontano alternative

REGOLE per competitors_found:
Estrai tutti i brand, aziende, insegne o entità commerciali citate.
INCLUDI: qualsiasi entità con un nome proprio specifico.
ESCLUDI: il brand target "${targetBrand}", sub-brand del target, descrizioni generiche senza nome proprio.
Restituisci SOLO il nome commerciale.

FONTI: Estrai TUTTI i siti web, domini, URL, blog, riviste, piattaforme citati o menzionati nella risposta.
Se la risposta cita una pagina specifica, estrai l'URL completo con path. Se hai solo il dominio usa domain, se hai il path completo usa url.
source_type: media|review|ecommerce|social|brand_owned|competitor|wikipedia|other

Analizza questa risposta:

${cleanResponse}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const stripped = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let parsed;
    try {
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? stripped);
    } catch {
      try {
        const competitorsMatch = stripped.match(/"competitors_found"\s*:\s*(\[[\s\S]*?\])/);
        const topicsMatch = stripped.match(/"topics"\s*:\s*(\[[\s\S]*?\])/);
        parsed = {
          competitors_found: competitorsMatch ? JSON.parse(competitorsMatch[1]) : [],
          topics: topicsMatch ? JSON.parse(topicsMatch[1]) : [],
          sources: [],
        };
      } catch {
        parsed = { competitors_found: [], topics: [], sources: [] };
      }
    }
    return {
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      competitors_found: Array.isArray(parsed.competitors_found)
        ? parsed.competitors_found.map((c: any) => {
            const raw = typeof c === "string" ? c : c.name;
            return typeof c === "string"
              ? { name: canonicalizeCompetitorName(raw), type: "direct" as const, rank: null, sentiment: null, recommendation: null }
              : { name: canonicalizeCompetitorName(raw), type: c.type ?? "direct", rank: c.rank ?? null, sentiment: c.sentiment ?? null, recommendation: c.recommendation ?? null };
          })
        : [],
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
  } catch (e) {
    console.error("[extractor] partial extraction failed:", e);
    return { topics: [], competitors_found: [], sources: [] };
  }
}

export async function extractFromResponse(
  response: string,
  targetBrand: string,
  knownCompetitors: string[],
  sector?: string,
  brandType?: string,
): Promise<ExtractionResult> {
  // Robust brand detection with variants and partial matching
  const detection = detectBrandMention(response, targetBrand);

  console.log(`[extractor] brand="${targetBrand}" detected=${detection.mentioned} occurrences=${detection.occurrences} variant="${detection.matchedVariant}" responseLen=${response.length}`);

  // If brand not present, use a lighter prompt for competitors/topics/sources only
  if (!detection.mentioned) {
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, knownCompetitors, sector, brandType
    );
    return {
      brand_mentioned: false,
      brand_rank: null,
      brand_occurrences: 0,
      sentiment_score: 0,
      tone_score: null,
      position_score: null,
      recommendation_score: null,
      brand_adjectives: [],
      topics: partialResult.topics,
      competitors_found: partialResult.competitors_found,
      sources: partialResult.sources,
    };
  }

  const sectorContext = sector
    ? `Settore: ${sector}`
    : `Settore: non specificato — inferisci dal contesto della risposta`;

  const brandTypeLabels: Record<string, string> = {
    manufacturer: "Produttore/Brand di prodotto",
    retailer: "Retailer o catena della grande distribuzione",
    service: "Servizio in abbonamento o SaaS",
    financial: "Istituto finanziario, banca o assicurazione",
    platform: "Piattaforma digitale o marketplace",
    local: "Business locale o catena territoriale",
    publisher: "Media, editore o piattaforma di contenuti",
    pharma: "Azienda farmaceutica o sanitaria",
    utility: "Utility, energia, telecomunicazioni",
  };
  const brandTypeContext = brandTypeLabels[brandType ?? "manufacturer"] ?? "Brand generico";

  const systemPrompt = `Sei un analista AI. Analizza la risposta di un modello AI ed estrai dati strutturati.

Brand da analizzare: "${targetBrand}"
${sectorContext}
Tipo brand: ${brandTypeContext}
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
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "recommendation": number }],
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
  - type: tipo di competitor ("direct"|"indirect"|"channel"|"aggregator")
  - rank: posizione in cui appare nella risposta (1=primo citato)
  - sentiment: tono con cui l'AI descrive il competitor (-1.0/+1.0)
  - recommendation: l'AI lo raccomanda? (+1=sì, 0=neutro, -1=sconsigliato)
  Stesse regole del tone_score per granularità e no-default-0.5.

REGOLA CRITICA: Se brand_mentioned è true, brand_rank, tone_score e recommendation_score sono OBBLIGATORI e non possono essere null.

TIPI COMPETITOR (multi-dimensionale):
1. DIRECT — stesso prodotto/servizio, stesso mercato target
2. INDIRECT — soddisfa lo stesso bisogno con approccio diverso
3. CHANNEL — canali distributivi che si interpongono tra brand e consumatore o vendono private label
4. AGGREGATOR — piattaforme di confronto o discovery che intercettano l'intento

Usa il settore e tipo brand per inferire il tipo corretto.
NON escludere entità perché "non sono competitor diretti" — in AI visibility ogni entità citata al posto del brand ha rilevanza strategica.

FONTI: Estrai TUTTI i siti web, domini, URL, blog, riviste, piattaforme citati o menzionati nella risposta, anche implicitamente.
Esempi: se dice 'secondo Gambero Rosso' → estrai 'gamberorosso.it', se dice 'disponibile su Amazon' → estrai 'amazon.it', se dice 'recensioni su Trustpilot' → estrai 'trustpilot.com'.
Se la risposta cita una pagina specifica, estrai l'URL completo con path. Se hai solo il dominio usa domain, se hai il path completo usa url.
source_type: media|review|ecommerce|social|brand_owned|competitor|wikipedia|other

REGOLE per competitors_found:
INCLUDI: qualsiasi entità con un nome proprio specifico.
ESCLUDI ASSOLUTAMENTE:
- Sub-brand o varianti del brand target (es. se target è 'Coca-Cola', escludi 'Coca-Cola Zero')
- Il brand target "${targetBrand}" stesso in qualsiasi forma
- Descrizioni generiche senza nome proprio
FORMATO: Restituisci SOLO il nome commerciale.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nAnalizza questa risposta:\n\n${response}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text"
    ? message.content[0].text
    : "{}";

  console.log(`[extractor] Haiku raw output (first 400): ${raw.slice(0, 400)}`);

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    // Use robust detection result for brand_mentioned
    const brandMentioned = detection.mentioned;

    // Enforce brand_rank when brand is mentioned
    let brandRank: number | null = parsed.brand_rank != null ? Number(parsed.brand_rank) : null;

    if (brandMentioned && brandRank == null) {
      brandRank = 1;
    }

    // Multidimensional sentiment
    const toneScore = parsed.tone_score ?? 0;
    const posScore = positionScore(brandRank, parsed.competitors_count ?? 0);
    const recScore = parsed.recommendation_score ?? 0;

    // Formula pesata con recommendation come componente additiva
    const base = (toneScore * 0.3) + (posScore * 0.5) + (recScore * 0.2);
    const sentimentFinal = Math.max(-1, Math.min(1, base)); // clamp -1/+1

    return {
      brand_mentioned: brandMentioned,
      brand_rank: brandRank,
      brand_occurrences: Number(parsed.brand_occurrences) || detection.occurrences,
      sentiment_score: sentimentFinal,
      tone_score: toneScore,
      position_score: posScore,
      recommendation_score: recScore,
      brand_adjectives: Array.isArray(parsed.brand_adjectives) ? parsed.brand_adjectives : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      competitors_found: (() => {
        const competitorsRaw = Array.isArray(parsed.competitors_found) ? parsed.competitors_found : [];
        return competitorsRaw.map((c: any) => {
          const raw = typeof c === 'string' ? c : c.name;
          return typeof c === 'string'
            ? { name: canonicalizeCompetitorName(raw), type: "direct" as const, rank: null, sentiment: null, recommendation: null }
            : { name: canonicalizeCompetitorName(raw), type: c.type ?? "direct", rank: c.rank ?? null, sentiment: c.sentiment ?? null, recommendation: c.recommendation ?? null };
        });
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
  } catch (parseErr) {
    // CRITICAL: Do not silently discard brand detection when JSON parsing fails.
    // The robust `detectBrandMention` result is still valid even if Claude Haiku
    // returned malformed JSON.
    console.error("[extractor] JSON parse failed for brand extraction. raw:", raw?.slice(0, 300), "error:", parseErr);

    // Still attempt partial extraction for competitors/topics
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, knownCompetitors, sector, brandType
    );

    return {
      brand_mentioned: detection.mentioned,
      brand_rank: detection.mentioned ? 1 : null,
      brand_occurrences: detection.occurrences,
      sentiment_score: detection.mentioned ? 0 : null,
      tone_score: null,
      position_score: null,
      recommendation_score: null,
      brand_adjectives: [],
      topics: partialResult.topics,
      competitors_found: partialResult.competitors_found,
      sources: partialResult.sources,
    };
  }
}

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
  language?: string,
): Promise<Pick<ExtractionResult, "topics" | "competitors_found" | "sources">> {
  // Clean control characters that may break Claude parsing
  const cleanResponse = response
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();

  if (!cleanResponse || cleanResponse.length < 50) {
    return { topics: [], competitors_found: [], sources: [] };
  }

  const lang = language === "en" ? "English" : language === "fr" ? "French" : language === "de" ? "German" : language === "es" ? "Spanish" : "Italian";
  const langInstr = `IMPORTANT: All extracted topics, labels, and context text MUST be in ${lang} — match the language of the response being analyzed.`;

  const prompt = `You are an AI analyst. The brand "${targetBrand}" is NOT present in this response.
Sector: ${sector ?? "generic"}
Brand type: ${brandType ?? "manufacturer"}
Known competitors: ${knownCompetitors.length > 0 ? knownCompetitors.join(", ") : "none specified"}

${langInstr}

Extract:
- competitors_found: max 3 most relevant brands mentioned, with competitive type
- topics: max 3 main topics discussed (in ${lang})
- sources: max 3 most relevant sites/domains cited

Respond ONLY with valid JSON. Max 3 competitors, max 3 topics, max 3 sources. No text before or after JSON.

Required JSON schema:
{
  "topics": string[],
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

COMPETITOR TYPES:
- direct: same product/service, same market
- indirect: different product, satisfies the same need
- channel: distribution channels
- aggregator: comparison/discovery platforms

RULES for competitors_found:
Extract all brands, companies, or commercial entities mentioned.
INCLUDE: any entity with a specific proper name.
EXCLUDE: the target brand "${targetBrand}", sub-brands of the target, generic descriptions.
Return ONLY the commercial name.

SOURCES: Extract ALL websites, domains, URLs, blogs, magazines, platforms cited in the response.
source_type: media|review|ecommerce|social|brand_owned|competitor|wikipedia|other

Analyze this response:

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
  language?: string,
): Promise<ExtractionResult> {
  // Robust brand detection with variants and partial matching
  const detection = detectBrandMention(response, targetBrand);

  console.log(`[extractor] brand="${targetBrand}" detected=${detection.mentioned} occurrences=${detection.occurrences} variant="${detection.matchedVariant}" responseLen=${response.length}`);

  // If brand not present, use a lighter prompt for competitors/topics/sources only
  if (!detection.mentioned) {
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, knownCompetitors, sector, brandType, language
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

  const lang = language === "en" ? "English" : language === "fr" ? "French" : language === "de" ? "German" : language === "es" ? "Spanish" : "Italian";

  const sectorContext = sector
    ? `Sector: ${sector}`
    : `Sector: not specified — infer from the response context`;

  const brandTypeLabels: Record<string, string> = {
    manufacturer: "Product manufacturer/brand",
    retailer: "Retailer or distribution chain",
    service: "Subscription service or SaaS",
    financial: "Financial institution, bank, or insurance",
    platform: "Digital platform or marketplace",
    local: "Local business or territorial chain",
    publisher: "Media, publisher, or content platform",
    pharma: "Pharmaceutical or healthcare company",
    utility: "Utility, energy, telecom",
  };
  const brandTypeContext = brandTypeLabels[brandType ?? "manufacturer"] ?? "Generic brand";

  const systemPrompt = `You are an AI analyst. Analyze an AI model's response and extract structured data.
IMPORTANT: All extracted topics, adjectives, labels, and text fields MUST be in ${lang} — match the language of the response being analyzed.

Brand to analyze: "${targetBrand}"
${sectorContext}
Brand type: ${brandTypeContext}
Known competitors: ${knownCompetitors.length > 0 ? knownCompetitors.join(", ") : "none specified"}

Respond ONLY with valid JSON, no markdown or extra text.

Required JSON schema:
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

Rules:
- brand_mentioned: true if the target brand appears in the response
- brand_rank: position where the brand appears relative to other brands.
  1 = mentioned first or as primary recommendation.
  2 = mentioned as second option.
  3+ = mentioned after other brands.
  null = ONLY if brand_mentioned is false.
  IMPORTANT: If brand_mentioned is true, brand_rank CANNOT be null.
- brand_occurrences: number of times the brand appears in the text
- competitors_count: how many total competitors are cited (DO NOT include the target brand)
- tone_score: Analyze the specific language used to describe the brand.
  First identify 2-3 key adjectives/phrases, then assign the score.
  Examples:
  - 'iconic, beloved, excellent quality' → +0.8
  - 'good, reliable, solid' → +0.5
  - 'known, available, among the best sellers' → +0.2
  - 'average, not particularly distinctive' → -0.1
  - 'criticized, controversial, problematic' → -0.6
  - 'not recommended, low quality' → -0.9
  IMPORTANT:
  - Use the full scale from -1.0 to +1.0 with 0.1 granularity
  - Do NOT default to 0.5 — reason from the text
  - If the brand has no specific adjectives use 0.2 (neutral-positive) or 0.0 (purely neutral)
  If brand_mentioned is false, use 0.0.
- brand_adjectives: list 2-3 key adjectives/phrases used to describe the brand (in ${lang}). Empty array if brand_mentioned is false.
- recommendation_score: Does the AI explicitly recommend the brand?
  +1.0 = explicitly recommended as first/only choice
  +0.5 = mentioned positively, depends on context
  0.0 = no recommendation expressed
  -0.5 = discouraged with reservations
  -1.0 = explicitly discouraged
  If brand_mentioned is false, use 0.0.
- topics: main topics discussed in the response (max 5, in ${lang})
- competitors_found: for each competitor found:
  - name: brand name
  - type: competitor type ("direct"|"indirect"|"channel"|"aggregator")
  - rank: position in which it appears (1=first cited)
  - sentiment: tone used (-1.0/+1.0)
  - recommendation: is it recommended? (+1=yes, 0=neutral, -1=discouraged)

CRITICAL RULE: If brand_mentioned is true, brand_rank, tone_score and recommendation_score are MANDATORY and cannot be null.

COMPETITOR TYPES:
1. DIRECT — same product/service, same target market
2. INDIRECT — satisfies the same need with a different approach
3. CHANNEL — distribution channels between brand and consumer
4. AGGREGATOR — comparison/discovery platforms

Use sector and brand type to infer the correct type.
Do NOT exclude entities because they are "not direct competitors" — in AI visibility every entity cited instead of the brand has strategic relevance.

SOURCES: Extract ALL websites, domains, URLs, blogs, magazines, platforms cited or mentioned in the response.
source_type: media|review|ecommerce|social|brand_owned|competitor|wikipedia|other

RULES for competitors_found:
INCLUDE: any entity with a specific proper name.
ABSOLUTELY EXCLUDE:
- Sub-brands or variants of the target brand (e.g. if target is 'Coca-Cola', exclude 'Coca-Cola Zero')
- The target brand "${targetBrand}" itself in any form
- Generic descriptions without a proper name
FORMAT: Return ONLY the commercial name.`;

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
      response, targetBrand, knownCompetitors, sector, brandType, language
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

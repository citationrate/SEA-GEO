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
  // Skip generic words that would produce too many false positives when matched alone
  const GENERIC_WORDS = new Set([
    // Articles & prepositions
    "il", "la", "le", "lo", "i", "gli", "un", "una", "the", "a", "an",
    "di", "del", "della", "dei", "delle", "of", "de",
    // Common prefixes
    "san", "saint", "new", "old", "gran", "grande", "big", "prima", "primo",
    "gruppo", "group", "società", "company", "brand",
    // Generic business words (IT)
    "soluzione", "soluzioni", "studio", "studi", "centro", "servizio", "servizi",
    "agenzia", "consulenza", "sistema", "sistemi", "rete", "punto", "casa",
    "mondo", "terra", "verde", "blu", "rosso", "oro", "luce", "sole",
    "facile", "veloce", "smart", "top", "best", "pro", "plus", "extra",
    "digital", "tech", "web", "net", "online", "global", "express",
    // Generic business words (EN)
    "solution", "solutions", "service", "services", "agency", "consulting",
    "center", "system", "systems", "network", "point", "home", "world",
    "easy", "fast", "quick", "direct", "blue", "green", "red", "gold",
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

/** Strip markdown and HTML formatting to get plain text for brand matching */
function stripMarkdown(s: string): string {
  return s
    // Code blocks (multi-line and inline)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    // Bold/italic combinations (must go before single)
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")  // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, "$1")      // **bold**
    .replace(/\*(.+?)\*/g, "$1")          // *italic*
    .replace(/___(.+?)___/g, "$1")        // ___bold italic___
    .replace(/__(.+?)__/g, "$1")          // __underline__
    .replace(/_(.+?)_/g, "$1")            // _italic_
    .replace(/~~(.+?)~~/g, "$1")          // ~~strikethrough~~
    // Links and images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")  // ![alt](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [text](url)
    // HTML tags
    .replace(/<[^>]+>/g, " ")
    // Headings
    .replace(/#{1,6}\s/g, "")
    // List markers
    .replace(/^[\s]*[-*+]\s/gm, "")
    .replace(/^[\s]*\d+\.\s/gm, "")
    // URLs (extract domain name — helps match brands in URLs like prisma.it)
    .replace(/https?:\/\/(?:www\.)?([a-zA-Z0-9-]+)\.[a-z]{2,}[^\s)"]*/gi, " $1 ")
    // Clean up extra whitespace
    .replace(/\s+/g, " ");
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
  const generic = isGenericBrandName(targetBrand);

  // For generic brand names, only try full-name match (skip single-word partials)
  const effectiveVariants = generic
    ? variants.filter((v) => v.includes(" ") || v === targetBrand.toLowerCase().trim())
    : variants;

  // Sort: longer variants first (full name before first-word)
  const sorted = effectiveVariants.sort((a, b) => b.length - a.length);

  // Strategy 1: Word-boundary regex on cleaned text
  for (const variant of sorted) {
    const variantNorm = stripAccents(variant);
    const pattern = new RegExp(`\\b${escapeRegex(variantNorm)}\\b`, "gi");
    const matches = responseNorm.match(pattern);
    if (matches && matches.length > 0) {
      return { mentioned: true, occurrences: matches.length, matchedVariant: variant };
    }
  }

  // Strategy 2: Try on raw response (before markdown stripping) — catches brands
  // inside markdown formatting that stripMarkdown might mangle
  const rawLower = stripAccents(response.toLowerCase());
  for (const variant of sorted) {
    const variantNorm = stripAccents(variant);
    // More permissive: allow brand surrounded by any non-alphanumeric char
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(variantNorm)}(?:[^a-z0-9]|$)`, "gi");
    const matches = rawLower.match(pattern);
    if (matches && matches.length > 0) {
      return { mentioned: true, occurrences: matches.length, matchedVariant: variant };
    }
  }

  return { mentioned: false, occurrences: 0, matchedVariant: null };
}

/** Check if a brand name is composed of generic/common words that could cause false positives */
function isGenericBrandName(brand: string): boolean {
  const GENERIC = new Set([
    "soluzione", "soluzioni", "solution", "solutions",
    "studio", "studi", "centro", "center",
    "servizio", "servizi", "service", "services",
    "agenzia", "agency", "consulenza", "consulting",
    "sistema", "sistemi", "system", "systems",
    "rete", "network", "punto", "point",
    "casa", "home", "mondo", "world",
    "gruppo", "group", "digital", "tech", "web", "online",
    "tasse", "tax", "taxes", "legale", "legal",
    "salute", "health", "verde", "green", "blu", "blue",
    "facile", "easy", "veloce", "fast", "smart", "express",
    "prima", "first", "top", "best", "pro", "plus",
    "energia", "energy", "luce", "light",
    "sport", "food", "design", "lab", "arte", "art",
  ]);
  const words = brand.toLowerCase().trim().split(/\s+/);
  // If ALL words in the brand name are generic, it's a generic name
  return words.length >= 1 && words.every((w) => GENERIC.has(w) || w.length <= 2);
}

/** Extract actual URLs and domains literally present in a response text.
 *  Catches AI citation patterns:
 *  - Full URLs: https://example.com/path
 *  - Markdown links: [text](https://example.com)
 *  - Numbered citations: [1] https://example.com
 *  - Bare domains: example.com, www.example.com
 *  - Perplexity-style: source: example.com
 */
function extractRealUrlsFromText(text: string): Set<string> {
  const domains = new Set<string>();

  // 1. Full URLs (http/https)
  const urlMatches = text.match(/https?:\/\/[^\s)\]>"',]+/gi) ?? [];
  for (const url of urlMatches) {
    try {
      const cleaned = url.replace(/[.),:;]+$/, ""); // strip trailing punctuation
      const hostname = new URL(cleaned).hostname.replace(/^www\./, "");
      domains.add(hostname.toLowerCase());
    } catch { /* invalid URL */ }
  }

  // 2. Markdown links: [text](url)
  const mdLinks = text.match(/\]\(https?:\/\/[^)]+\)/gi) ?? [];
  for (const link of mdLinks) {
    const url = link.slice(2, -1); // remove ]( and )
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      domains.add(hostname.toLowerCase());
    } catch { /* invalid URL */ }
  }

  // 3. Bare domains with common TLDs (www.example.com or example.com)
  const TLDS = "com|it|org|net|io|co|eu|uk|de|fr|es|info|biz|app|dev|ai|tech|online|store|shop";
  const bareDomainRe = new RegExp(`(?:www\\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.(?:${TLDS}))(?:\\b|[\\s/])`, "gi");
  let match;
  while ((match = bareDomainRe.exec(text)) !== null) {
    domains.add(match[1].toLowerCase());
  }

  return domains;
}

/** Filter AI-extracted sources to only keep those whose domain actually appears in the response */
function validateSources<T extends { domain: string | null }>(
  sources: T[],
  response: string,
): T[] {
  const realDomains = extractRealUrlsFromText(response);
  if (realDomains.size === 0) return []; // No real URLs in text → all sources are hallucinations

  return sources.filter((s) => {
    const domain = (s.domain ?? "").toLowerCase().replace(/^www\./, "");
    if (!domain) return false;
    // Check if the domain (or a part of it) is in the real domains set
    return realDomains.has(domain) || Array.from(realDomains).some((rd) => rd.includes(domain) || domain.includes(rd));
  });
}

function positionScore(rank: number | null, nCompetitors: number): number {
  if (!rank || rank === 0) return 0.5; // presente ma non classificabile
  if (nCompetitors === 0) {
    // No competitor count available — derive score from rank alone
    // rank 1 → 1.0, rank 2 → 0.8, rank 3 → 0.6, etc.
    return Math.max(0, 1 - (rank - 1) * 0.2);
  }
  return Math.max(0, 1 - ((rank - 1) / nCompetitors));
}

async function extractCompetitorsTopicsSources(
  response: string,
  targetBrand: string,
  knownCompetitors: string[],
  sector?: string,
  brandType?: string,
  language?: string,
  brandDomain?: string | null,
): Promise<Pick<ExtractionResult, "topics" | "competitors_found" | "sources">> {
  // Clean control characters and Perplexity-style citation markers [1], [2], etc.
  // that can confuse Haiku into including them in competitor names
  const cleanResponse = response
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\[(\d{1,2})\]/g, "")
    .replace(/\s{2,}/g, " ")
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
- competitors_found: ALL brands/companies/services mentioned that compete with the target brand
- topics: main topics discussed (in ${lang})
- sources: most relevant sites/domains cited

Respond ONLY with valid JSON. No text before or after JSON.

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

SOURCES — extract ONLY real citations used to justify the response:
- Extract URLs/domains that the AI cites AS SOURCES for its answer
- Valid citation patterns: "[1] https://example.com", "Fonte: www.example.com", inline links "[text](https://url)", "source: domain.com", numbered references with URLs at the end
- ONLY extract domains/URLs that are LITERALLY written in the response text as strings
- DO NOT infer domains from brand names (if it says "Amazon" without a URL, do NOT add "amazon.it")
- DO NOT invent URLs — if no explicit URLs or domains appear in the text, return "sources": []
source_type: media|review|ecommerce|social|competitor|wikipedia|other

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
      sources: validateSources(
        Array.isArray(parsed.sources)
          ? parsed.sources.map((s: any) => ({
              url: s.url ?? null,
              domain: s.domain ?? null,
              label: s.label ?? null,
              source_type: VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other",
              is_brand_owned: Boolean(s.is_brand_owned),
              context: s.context ?? null,
            }))
          : [],
        response,
      ),
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
  brandDomain?: string | null,
): Promise<ExtractionResult> {
  // Robust brand detection with variants and partial matching
  const detection = detectBrandMention(response, targetBrand);

  console.log(`[extractor] brand="${targetBrand}" detected=${detection.mentioned} occurrences=${detection.occurrences} variant="${detection.matchedVariant}" responseLen=${response.length} preview="${response.substring(0, 150).replace(/\n/g, " ")}"`);

  // If brand not present, use a lighter prompt for competitors/topics/sources only
  if (!detection.mentioned) {
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, knownCompetitors, sector, brandType, language, brandDomain
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

  const domainContext = brandDomain ? `\nBrand website: ${brandDomain}` : "";
  const genericNameWarning = isGenericBrandName(targetBrand)
    ? `\n\nCRITICAL — GENERIC BRAND NAME WARNING: The brand "${targetBrand}" contains common/generic words. You MUST distinguish between:
- The SPECIFIC COMPANY/BRAND "${targetBrand}"${brandDomain ? ` (website: ${brandDomain})` : ""} being mentioned as an entity
- Generic use of the same words in normal language (e.g. "soluzione" meaning "solution", "tasse" meaning "taxes")
Only set brand_mentioned=true if the response refers to "${targetBrand}" as a SPECIFIC company/brand/entity, NOT when the words appear in their generic meaning.`
    : "";

  const systemPrompt = `You are an AI analyst. Analyze an AI model's response and extract structured data.
IMPORTANT: All extracted topics, adjectives, labels, and text fields MUST be in ${lang} — match the language of the response being analyzed.

Brand to analyze: "${targetBrand}"${domainContext}
${sectorContext}
Brand type: ${brandTypeContext}
Known competitors: ${knownCompetitors.length > 0 ? knownCompetitors.join(", ") : "none specified"}${genericNameWarning}

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
- topics: main topics discussed in the response (in ${lang})
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

SOURCES — CRITICAL RULES TO AVOID HALLUCINATIONS:
- Extract ONLY URLs and domains that are EXPLICITLY written in the response as actual links or URL strings
- DO NOT infer domains from brand/company mentions (e.g. if it says "Amazon" do NOT add "amazon.it" unless the URL is literally in the text)
- DO NOT invent or guess URLs — if no explicit URLs appear in the response, return "sources": []
- Only include a source if you can point to the exact URL/domain string in the response text
source_type: media|review|ecommerce|social|competitor|wikipedia|other

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
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        // Strip Perplexity-style citation markers [1], [2] that can pollute extracted names
        content: `${systemPrompt}\n\nAnalizza questa risposta:\n\n${response.replace(/\[(\d{1,2})\]/g, "").replace(/\s{2,}/g, " ")}`,
      },
    ],
  });

  const raw = message.content[0]?.type === "text"
    ? message.content[0].text
    : "{}";

  console.log(`[extractor] Haiku raw output (first 500): ${raw.slice(0, 500)}`);
  console.log(`[extractor] Haiku stop_reason: ${message.stop_reason}, usage: input=${message.usage?.input_tokens} output=${message.usage?.output_tokens}`);

  try {
    // Strip markdown code fences if present, then extract JSON object
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned);

    // Use robust detection result for brand_mentioned
    const brandMentioned = detection.mentioned;

    // Enforce brand_rank when brand is mentioned
    let brandRank: number | null = parsed.brand_rank != null ? Number(parsed.brand_rank) : null;

    if (brandMentioned && brandRank == null) {
      brandRank = 1;
    }

    // Multidimensional sentiment — position tracked SEPARATELY via brand_rank/rank_score
    // to avoid double-counting in AVI (which already weights rank_score at 35%)
    const toneScore = parsed.tone_score ?? 0;
    const posScore = positionScore(brandRank, parsed.competitors_count ?? 0);
    const recScore = parsed.recommendation_score ?? 0;

    // Sentiment = tone + recommendation only (NO position — position goes to AVI's rank_score)
    const base = (toneScore * 0.6) + (recScore * 0.4);
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
      sources: validateSources(
        Array.isArray(parsed.sources)
          ? parsed.sources.map((s: any) => ({
              url: s.url ?? null,
              domain: s.domain ?? null,
              label: s.label ?? null,
              source_type: VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other",
              is_brand_owned: Boolean(s.is_brand_owned),
              context: s.context ?? null,
            }))
          : [],
        response,
      ),
    };
  } catch (parseErr) {
    // CRITICAL: Do not silently discard brand detection when JSON parsing fails.
    // The robust `detectBrandMention` result is still valid even if Claude Haiku
    // returned malformed JSON.
    console.error("[extractor] JSON parse failed for brand extraction. raw:", raw?.slice(0, 300), "error:", parseErr);

    // Still attempt partial extraction for competitors/topics
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, knownCompetitors, sector, brandType, language, brandDomain
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

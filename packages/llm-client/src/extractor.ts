import Anthropic from "@anthropic-ai/sdk";
import { canonicalizeCompetitorName, extractBrandOnly } from "./competitor-names";

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
    tone: number | null;
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
    // Legal / insurance / finance category words (IT + EN)
    "risarcimento", "danni", "danno", "sinistri", "sinistro", "gestione",
    "assicurazione", "assicurazioni", "polizza", "polizze", "perizia", "perizie",
    "fiscale", "fiscali", "tasse", "tributario", "contabile", "contabilità",
    "legale", "legali", "avvocato", "avvocati", "notaio", "notarile",
    "immobiliare", "immobiliari", "edilizia", "costruzioni",
    "medico", "medica", "clinica", "dentale", "odontoiatrico",
    "insurance", "claims", "damage", "damages", "legal", "tax", "taxes",
    "accounting", "dental", "medical", "clinic", "real estate",
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

  // For brands with generic category suffixes (e.g. "Giesse Risarcimento Danni"),
  // add the distinctive prefix as a variant and ensure the generic suffix alone
  // is NOT a variant that could cause false positives.
  const distinctivePrefix = extractDistinctivePrefix(clean);
  if (distinctivePrefix) {
    variants.add(distinctivePrefix.toLowerCase());
    variants.add(stripAccents(distinctivePrefix).toLowerCase());
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
    // Legal / insurance / finance
    "risarcimento", "danni", "danno", "sinistri", "sinistro", "gestione",
    "assicurazione", "assicurazioni", "polizza", "perizia",
    "fiscale", "fiscali", "tributario", "contabile",
    "immobiliare", "immobiliari", "edilizia",
    "medico", "medica", "clinica", "dentale",
    "insurance", "claims", "damage", "damages", "accounting",
    "dental", "medical", "clinic",
  ]);
  const words = brand.toLowerCase().trim().split(/\s+/);
  // If ALL words in the brand name are generic, it's a generic name
  return words.length >= 1 && words.every((w) => GENERIC.has(w) || w.length <= 2);
}

/**
 * Check if a brand has a generic category suffix (e.g. "Giesse Risarcimento Danni").
 * Returns the distinctive prefix if found, or null.
 * Used to prevent false positives when only the generic suffix appears in text.
 */
function extractDistinctivePrefix(brand: string): string | null {
  const CATEGORY_WORDS = new Set([
    // Italian category/sector terms
    "risarcimento", "danni", "danno", "sinistri", "sinistro", "gestione",
    "assicurazione", "assicurazioni", "consulenza", "fiscale", "fiscali",
    "legale", "legali", "immobiliare", "immobiliari", "edilizia",
    "medico", "medica", "clinica", "dentale", "odontoiatrico",
    "servizio", "servizi", "soluzione", "soluzioni", "studio", "studi",
    "centro", "agenzia", "sistema", "sistemi", "gruppo",
    "tasse", "tributario", "contabile", "contabilità",
    // English equivalents
    "insurance", "claims", "damage", "damages", "consulting", "legal",
    "tax", "taxes", "accounting", "dental", "medical", "clinic",
    "service", "services", "solution", "solutions", "agency", "center",
  ]);

  const words = brand.trim().split(/\s+/);
  if (words.length < 2) return null;

  // Find where the generic suffix starts
  let distinctiveEnd = words.length;
  for (let i = words.length - 1; i >= 1; i--) {
    if (CATEGORY_WORDS.has(words[i].toLowerCase())) {
      distinctiveEnd = i;
    } else {
      break;
    }
  }

  // If we found a generic suffix, return the distinctive prefix
  if (distinctiveEnd < words.length && distinctiveEnd >= 1) {
    return words.slice(0, distinctiveEnd).join(" ");
  }
  return null;
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

/** Sector-aware guidance for competitor extraction */
function getSectorCompetitorGuidance(sector?: string): string {
  const s = (sector ?? "").toLowerCase();
  const sectorMap: Record<string, string> = {
    "legal": "law firms, consulting firms, claims management companies, legal-tech platforms",
    "legale": "studi legali, società di consulenza, società di gestione sinistri, piattaforme legal-tech",
    "financial": "financial advisors, brokers, insurance companies, fintech platforms, consulting firms",
    "finanziario": "consulenti finanziari, broker, compagnie assicurative, piattaforme fintech, società di consulenza",
    "insurance": "insurance companies, brokers, claims management firms, insurtech platforms",
    "assicurativo": "compagnie assicurative, broker, società di gestione sinistri, piattaforme insurtech",
    "health": "clinics, medical centers, health platforms, private hospitals, health-tech companies",
    "salute": "cliniche, centri medici, piattaforme sanitarie, ospedali privati, aziende health-tech",
    "retail": "online stores, marketplaces, brands, e-commerce platforms",
    "ecommerce": "online stores, marketplaces, brands, e-commerce platforms",
    "tech": "SaaS companies, software providers, digital agencies, tech platforms",
    "software": "SaaS companies, software providers, digital agencies, tech platforms",
    "food": "food brands, restaurant chains, food companies, food delivery platforms",
    "tourism": "hotels, tour operators, booking platforms, travel agencies",
    "turismo": "hotel, tour operator, piattaforme di prenotazione, agenzie di viaggio",
    "local": "local agencies, studios, local businesses, professional firms",
  };

  let validTypes = "";
  for (const [key, types] of Object.entries(sectorMap)) {
    if (s.includes(key)) {
      validTypes = types;
      break;
    }
  }

  if (!validTypes) {
    validTypes = "companies, agencies, studios, or services that a customer could hire or buy from";
  }

  return `For this sector (${sector ?? "generic"}), valid competitors are: ${validTypes}.`;
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
    .trim()
    .slice(0, 3000);

  if (!cleanResponse || cleanResponse.length < 50) {
    return { topics: [], competitors_found: [], sources: [] };
  }

  const lang = language === "en" ? "English" : language === "fr" ? "French" : language === "de" ? "German" : language === "es" ? "Spanish" : "Italian";
  const langInstr = `IMPORTANT: All extracted topics, labels, and context text MUST be in ${lang} — match the language of the response being analyzed.`;

  const sectorCompetitorGuidance = getSectorCompetitorGuidance(sector);

  const prompt = `You are an AI analyst. The brand "${targetBrand}" is NOT present in this response.
Sector: ${sector ?? "generic"}
Brand type: ${brandType ?? "manufacturer"}

${langInstr}

Extract ONLY commercial competitors — companies, agencies, studios, or services that a customer could choose INSTEAD of "${targetBrand}" for the same service.

${sectorCompetitorGuidance}

Extract:
- competitors_found: ALL commercial brands/companies/services mentioned that compete with the target brand
- topics: main topics discussed (in ${lang})
- sources: most relevant sites/domains cited

Respond ONLY with valid JSON. No text before or after JSON.

Required JSON schema:
{
  "topics": string[],
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "tone": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

For each competitor in competitors_found:
- rank: position of first mention (1 = first mentioned brand)
- sentiment: overall sentiment toward this competitor (-1.0 to +1.0)
- tone: language quality/positivity toward this competitor (0.0 to 1.0, where 0 = very negative, 0.5 = neutral, 1.0 = very positive)
- recommendation: is this competitor recommended? (1.0 = strongly recommended, 0.5 = neutral mention, 0.0 = not recommended)

COMPETITOR TYPES:
- direct: same product/service, same market
- indirect: different product, satisfies the same need
- channel: distribution channels
- aggregator: comparison/discovery platforms

COMPETITOR RULES:
Extract ONLY the parent brand/company name for each competitor mentioned. Never include product model names, version numbers, or product lines.
Examples: 'Samsung Galaxy S24 Ultra' → 'Samsung', 'Asus ProArt Studiobook' → 'Asus', 'Google Pixel Watch' → 'Google', 'Microsoft Surface' → 'Microsoft', 'Dell XPS 14' → 'Dell'.
Return the brand name only, not the full product name. Deduplicate: if the same brand appears multiple times with different products, return it once.
Extract ONLY commercial competitors — companies/services a user could choose instead of "${targetBrand}".
INCLUDE: companies, brands, services that sell/provide the same service and compete for the same customer.
EXCLUDE: "${targetBrand}" itself (any form), sub-brands/variants, generic descriptions without a proper name.

NEVER extract:
- Government agencies (Ministero, Regione, INAIL, INPS, CONSAP, Comune, Provincia, Prefettura)
- Regulatory bodies (IVASS, Garante, Autorità, CONSOB, AGCM, ANAC)
- Trade unions or patronati (CGIL, CISL, UIL, INCA, ANMIL, patronato, CAF)
- Consumer associations (Altroconsumo, Codacons, Adiconsum, Federconsumatori)
- Public portals or offices (portale automobilista, sportello pubblico, ufficio pubblico)
- Courts or legal institutions (Tribunale, Corte, Cassazione)
- Industry associations (Confindustria, ANIA, ABI, Ordine degli/dei, Confcommercio)

If a name sounds like an institution, exclude it. If a name sounds like a commercial company, include it.
Return ONLY company/brand names, never product names or model numbers.

SOURCES — extract ONLY URLs/domains LITERALLY written in the response. Do NOT infer domains from brand names. If no explicit URLs appear, return "sources": [].
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
      competitors_found: (() => {
        const mapped = Array.isArray(parsed.competitors_found)
          ? parsed.competitors_found.map((c: any) => {
              const raw = typeof c === "string" ? c : c.name;
              if (typeof c === "string") {
                return { name: canonicalizeCompetitorName(extractBrandOnly(raw)), type: "direct" as const, rank: null, sentiment: null, tone: null, recommendation: null };
              }
              const compTone = c.sentiment ?? 0;
              const compRec = c.recommendation ?? 0;
              const compSentiment = Math.max(-1, Math.min(1, (compTone * 0.6) + (compRec * 0.4)));
              return {
                name: canonicalizeCompetitorName(extractBrandOnly(raw)),
                type: c.type ?? "direct",
                rank: c.rank ?? null,
                sentiment: compSentiment,
                tone: c.tone != null ? Math.max(0, Math.min(1, Number(c.tone))) : null,
                recommendation: c.recommendation != null ? Math.max(0, Math.min(1, Number(c.recommendation))) : null,
              };
            })
          : [];
        // Deduplicate by brand name (keep first occurrence)
        const seen = new Set<string>();
        return mapped.filter((c: any) => {
          const key = c.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
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
  } catch (e) {
    console.error("[extractor] partial extraction failed:", e);
    return { topics: [], competitors_found: [], sources: [] };
  }
}

export async function extractFromResponse(
  response: string,
  targetBrand: string,
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
      response, targetBrand, sector, brandType, language, brandDomain
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
  const distinctivePrefix = extractDistinctivePrefix(targetBrand);
  const hasGenericWords = isGenericBrandName(targetBrand) || distinctivePrefix != null;
  const genericNameWarning = hasGenericWords
    ? `\n\nCRITICAL — GENERIC CATEGORY WORDS IN BRAND NAME:
The brand "${targetBrand}" contains generic category words${distinctivePrefix ? ` (distinctive identifier: "${distinctivePrefix}")` : ""}.
You MUST distinguish between:
- BRAND MENTION: "${targetBrand}" or "${distinctivePrefix ?? targetBrand}" referenced as a specific company/entity → brand_mentioned=true
- GENERIC USE: category words like "${targetBrand.split(/\s+/).slice(distinctivePrefix ? distinctivePrefix.split(/\s+/).length : 0).join(" ")}" used in their normal meaning (e.g. "il risarcimento danni è un diritto", "consulenza fiscale gratuita") → brand_mentioned=false
Only set brand_mentioned=true if the response refers to the SPECIFIC COMPANY "${targetBrand}"${brandDomain ? ` (website: ${brandDomain})` : ""}, NOT when category words appear generically.`
    : "";

  const sectorGuidance = getSectorCompetitorGuidance(sector);

  const competitorExclusionRules = `Extract ONLY the parent brand/company name for each competitor mentioned. Never include product model names, version numbers, or product lines.
Examples: 'Samsung Galaxy S24 Ultra' → 'Samsung', 'Asus ProArt Studiobook' → 'Asus', 'Google Pixel Watch' → 'Google', 'Microsoft Surface' → 'Microsoft', 'Dell XPS 14' → 'Dell'.
Return the brand name only, not the full product name. Deduplicate: if the same brand appears multiple times with different products, return it once.
Extract ONLY commercial competitors — companies, agencies, studios, or services that a customer could choose INSTEAD of "${targetBrand}" for the same service.
INCLUDE: companies, brands, services that sell/provide the same service and compete for the same customer.

${sectorGuidance}

NEVER extract:
- Government agencies (Ministero, Regione, INAIL, INPS, CONSAP, Comune, Provincia, Prefettura)
- Regulatory bodies (IVASS, Garante, Autorità, CONSOB, AGCM, ANAC)
- Trade unions or patronati (CGIL, CISL, UIL, INCA, ANMIL, patronato, CAF)
- Consumer associations (Altroconsumo, Codacons, Adiconsum, Federconsumatori)
- Public portals or offices (portale automobilista, sportello pubblico, ufficio pubblico)
- Courts or legal institutions (Tribunale, Corte, Cassazione)
- Industry associations (Confindustria, ANIA, ABI, Ordine degli/dei, Confcommercio)
- "${targetBrand}" itself (any form), sub-brands/variants, generic descriptions without a proper name

If a name sounds like an institution, exclude it. If a name sounds like a commercial company, include it.
Return ONLY company/brand names, never product names or model numbers.`;

  const systemPrompt = `You are an AI analyst. Extract structured data from an AI response. All text fields MUST be in ${lang}.

Brand: "${targetBrand}"${domainContext}
${sectorContext}
Brand type: ${brandTypeContext}
${genericNameWarning}

Respond ONLY with valid JSON, no markdown or extra text.

JSON schema:
{
  "brand_mentioned": boolean,
  "brand_rank": number | null,
  "brand_occurrences": number,
  "competitors_count": number,
  "tone_score": number,
  "recommendation_score": number,
  "brand_adjectives": string[],
  "topics": string[],
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "tone": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

Field rules:
- brand_mentioned: true if target brand appears in response
- brand_rank: the EXACT position where "${targetBrand}" first appears in the response, counting from 1.
  Determine rank by counting DISTINCT brand/company mentions in order of appearance:
  - Count only DISTINCT brand/company names, not product model names
  - Rank = position of first mention of "${targetBrand}" relative to other brands
  - If "${targetBrand}" is the ONLY brand mentioned → rank 1
  - If "${targetBrand}" is mentioned in the opening sentence with no other brands before it → rank 1
  - If other brands are mentioned BEFORE "${targetBrand}" → rank > 1
  - If the response lists options/alternatives and "${targetBrand}" is 3rd in the list → rank 3
  - Example: "Samsung and Google dominate the market, while Apple offers premium alternatives" → Apple rank = 3
  - Do NOT assume rank 1 if uncertain — return null if position cannot be clearly determined
  - null if brand_mentioned=false
- brand_occurrences: count of brand appearances
- competitors_count: total competitors cited (exclude target brand)
- tone_score: language sentiment toward brand on [-1.0, +1.0] scale with 0.1 granularity. Identify 2-3 key adjectives first, then score.
  Examples: 'iconic, excellent quality' → +0.8 | 'good, reliable' → +0.5 | 'criticized, problematic' → -0.6
  Do NOT default to 0.5 — reason from text. No adjectives → 0.2 (neutral-positive) or 0.0 (neutral). If brand_mentioned=false → 0.0.
- brand_adjectives: 2-3 key adjectives describing brand (in ${lang}). Empty if not mentioned.
- recommendation_score: +1.0=explicitly recommended first, +0.5=positive mention, 0.0=none, -0.5=discouraged, -1.0=explicitly discouraged. If brand_mentioned=false → 0.0.
- topics: main topics discussed (in ${lang})
- competitors_found: name, type (direct|indirect|channel|aggregator), rank (1=first cited), sentiment (-1.0/+1.0), tone (0.0 to 1.0: language positivity), recommendation (1.0=strongly recommended, 0.5=neutral, 0.0=not recommended)

CRITICAL: If brand_mentioned=true, brand_rank/tone_score/recommendation_score are MANDATORY (cannot be null).

Competitor types: DIRECT=same product+market, INDIRECT=different product same need, CHANNEL=distribution, AGGREGATOR=comparison/discovery platforms.
Use sector and brand type to infer type. Include ALL cited entities — every brand cited instead of target has strategic relevance.

${competitorExclusionRules}

SOURCES — extract ONLY URLs/domains LITERALLY written in the response text. Do NOT infer domains from brand names. If no explicit URLs appear, return "sources": [].
source_type: media|review|ecommerce|social|competitor|wikipedia|other`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nAnalizza questa risposta:\n\n${response.replace(/\[(\d{1,2})\]/g, "").replace(/\s{2,}/g, " ").slice(0, 3000)}`,
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

    // Do NOT default to rank 1 when Haiku returns null — null means
    // position could not be clearly determined, which is more accurate
    // than assuming the brand is ranked first.

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
        const mapped = competitorsRaw.map((c: any) => {
          const raw = typeof c === 'string' ? c : c.name;
          if (typeof c === 'string') {
            return { name: canonicalizeCompetitorName(extractBrandOnly(raw)), type: "direct" as const, rank: null, sentiment: null, tone: null, recommendation: null };
          }
          const compTone = c.sentiment ?? 0;
          const compRec = c.recommendation ?? 0;
          const compSentiment = Math.max(-1, Math.min(1, (compTone * 0.6) + (compRec * 0.4)));
          return {
            name: canonicalizeCompetitorName(extractBrandOnly(raw)),
            type: c.type ?? "direct",
            rank: c.rank ?? null,
            sentiment: compSentiment,
            tone: c.tone != null ? Math.max(0, Math.min(1, Number(c.tone))) : null,
            recommendation: c.recommendation != null ? Math.max(0, Math.min(1, Number(c.recommendation))) : null,
          };
        });
        // Deduplicate by brand name (keep first occurrence)
        const seen = new Set<string>();
        return mapped.filter((c: any) => {
          const key = c.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
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

    // Try to salvage partial data from the malformed Haiku output instead of
    // making a second Haiku call (saves ~$0.0014 per failure).
    let partialTopics: string[] = [];
    let partialCompetitors: ExtractionResult["competitors_found"] = [];
    let partialSources: ExtractionResult["sources"] = [];
    try {
      const stripped = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const topicsMatch = stripped.match(/"topics"\s*:\s*(\[[\s\S]*?\])/);
      const competitorsMatch = stripped.match(/"competitors_found"\s*:\s*(\[[\s\S]*?\])/);
      const sourcesMatch = stripped.match(/"sources"\s*:\s*(\[[\s\S]*?\])/);
      if (topicsMatch) partialTopics = JSON.parse(topicsMatch[1]);
      if (competitorsMatch) {
        partialCompetitors = JSON.parse(competitorsMatch[1]).map((c: any) => {
          const name = typeof c === "string" ? c : c.name;
          if (typeof c === "string") return { name: canonicalizeCompetitorName(extractBrandOnly(name)), type: "direct" as const, rank: null, sentiment: null, tone: null, recommendation: null };
          const compTone = c.sentiment ?? 0;
          const compRec = c.recommendation ?? 0;
          return { name: canonicalizeCompetitorName(extractBrandOnly(name)), type: c.type ?? "direct", rank: c.rank ?? null, sentiment: Math.max(-1, Math.min(1, (compTone * 0.6) + (compRec * 0.4))), tone: c.tone != null ? Math.max(0, Math.min(1, Number(c.tone))) : null, recommendation: c.recommendation != null ? Math.max(0, Math.min(1, Number(c.recommendation))) : null };
        });
      }
      if (sourcesMatch) {
        partialSources = validateSources(
          JSON.parse(sourcesMatch[1]).map((s: any) => ({
            url: s.url ?? null, domain: s.domain ?? null, label: s.label ?? null,
            source_type: VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other",
            is_brand_owned: Boolean(s.is_brand_owned), context: s.context ?? null,
          })),
          response,
        );
      }
    } catch {
      // Partial extraction also failed — return empty arrays
    }

    return {
      brand_mentioned: detection.mentioned,
      brand_rank: detection.mentioned ? 1 : null,
      brand_occurrences: detection.occurrences,
      sentiment_score: detection.mentioned ? 0 : null,
      tone_score: null,
      position_score: null,
      recommendation_score: null,
      brand_adjectives: [],
      topics: partialTopics,
      competitors_found: partialCompetitors,
      sources: partialSources,
    };
  }
}

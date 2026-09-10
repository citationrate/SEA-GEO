import Anthropic from "@anthropic-ai/sdk";
import { canonicalizeCompetitorName, extractBrandOnly } from "./competitor-names";
import { trackedAICall } from "./cost-tracker";

const HAIKU_API_MODEL = "claude-haiku-4-5-20251001";

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
/**
 * Single source of truth for "brand-name words too generic to use as a
 * standalone partial match". Used by both buildBrandVariants (to skip
 * first-word partials) and isGenericBrandName (to flag full names that are
 * entirely generic). Keep lowercase, stripped of accents.
 */
const BRAND_GENERIC_WORDS = new Set<string>([
  // Articles & prepositions
  "il", "la", "le", "lo", "i", "gli", "un", "una", "the", "a", "an",
  "di", "del", "della", "dei", "delle", "of", "de",
  // Common prefixes / corporate boilerplate
  "san", "saint", "new", "old", "gran", "grande", "big", "prima", "primo",
  "gruppo", "group", "societa", "company", "brand", "studio", "studi",
  // Generic business words (IT)
  "soluzione", "soluzioni", "centro", "servizio", "servizi",
  "agenzia", "consulenza", "sistema", "sistemi", "rete", "punto", "casa",
  "mondo", "terra", "verde", "blu", "rosso", "oro", "luce", "sole",
  "facile", "veloce", "smart", "top", "best", "pro", "plus", "extra",
  "digital", "tech", "web", "net", "online", "global", "express",
  // Generic business words (EN)
  "solution", "solutions", "service", "services", "agency", "consulting",
  "center", "system", "systems", "network", "point", "home", "world",
  "easy", "fast", "quick", "direct", "blue", "green", "red", "gold",
  "base",
  // Legal / insurance / finance
  "risarcimento", "danni", "danno", "sinistri", "sinistro", "gestione",
  "assicurazione", "assicurazioni", "polizza", "polizze", "perizia", "perizie",
  "fiscale", "fiscali", "tasse", "tributario", "contabile", "contabilita",
  "legale", "legali", "avvocato", "avvocati", "notaio", "notarile",
  "immobiliare", "immobiliari", "edilizia", "costruzioni",
  "medico", "medica", "clinica", "dentale", "odontoiatrico",
  "insurance", "claims", "damage", "damages", "legal", "tax", "taxes",
  "accounting", "dental", "medical", "clinic",
  // Health / wellness / care
  "health", "salute", "beauty", "bellezza", "care", "cura",
  "wellness", "benessere", "life", "vita", "fit", "fitness",
  "body", "corpo", "mind", "mente",
  // Family / demographics
  "woman", "women", "donna", "donne", "man", "men", "uomo", "uomini",
  "kids", "bambini", "baby", "family", "famiglia", "mom", "mamma",
  // Dental / medical (extra)
  "dentista", "dentisti", "dentist", "dentists",
  "odontoiatra", "odontoiatri",
  "doctor", "dottore", "dottori", "clinics", "cliniche",
  // Food / drink
  "food", "drink", "bar", "cafe", "coffee",
  "wine", "vino", "beer", "birra",
  // Tech / data / metrics (common in AI/SaaS taxonomy)
  "citation", "citations", "data", "analytics", "insights", "metrics",
  "ai", "tracker", "monitor", "score", "rate", "index",
  "report", "reports", "platform", "app", "software",
  // Style / industry common
  "fashion", "style", "design", "art", "villa", "palazzo",
  "news", "media", "tv", "radio", "journal", "magazine", "press",
  // Common first names (prevent "Antonio Lupi" matching "Antonio Citterio")
  "antonio", "mario", "luigi", "giovanni", "francesco", "marco",
  "paolo", "andrea", "matteo", "alessandro", "stefano", "roberto",
  "anna", "maria", "laura", "giulia", "sara", "elena", "francesca",
  "john", "james", "robert", "michael", "william", "david", "richard",
  "mary", "patricia", "jennifer", "linda",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize curly/typographic apostrophes and grave accents to the ASCII
 * apostrophe. AI responses (and copy-pasted brand names) often use these
 * variants interchangeably \u2014 without this, "L'Or\u00e9al" (DB, U+2019) and
 * "L'Or\u00e9al" (response, U+0027) would not match.
 */
function normalizeApostrophes(s: string): string {
  // U+2018 ' / U+2019 ' / U+201B \u201b / U+2032 \u2032 / U+0060 `
  return s.replace(/[\u2018\u2019\u201b\u2032`]/g, "'");
}

/** Escape a string for use inside a RegExp */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Classe di separatori equivalenti tra nome brand e testo: spazi (anche nbsp),
 *  trattini/lineette varie, punto, middle-dot, slash. Rende "Audio-Technica",
 *  "Audio Technica" e "Audio.Technica" la stessa cosa in fase di match. */
const SEP = "[\\s\\u00a0\\u2010-\\u2015\\-._\\u00b7/]";
const SEP_SPLIT = new RegExp(SEP + "+", "g");

/** Regex separator-insensitive per una variante: le parti del brand possono
 *  essere unite da uno o più separatori diversi (trattino/spazio/punto…). */
function separatorFlexiblePattern(variant: string): string {
  const parts = variant.split(SEP_SPLIT).filter(Boolean).map(escapeRegex);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `\\b${parts[0]}\\b`;
  return `\\b${parts.join(`${SEP}+`)}\\b`;
}

/** Variante permissiva (brand circondato da qualunque non-alfanumerico). */
function separatorFlexiblePatternLoose(variant: string): string {
  const parts = variant.split(SEP_SPLIT).filter(Boolean).map(escapeRegex);
  if (parts.length === 0) return "";
  const core = parts.length === 1 ? parts[0] : parts.join(`${SEP}+`);
  return `(?:^|[^a-z0-9])${core}(?:[^a-z0-9]|$)`;
}

/** Verifica deterministica che una forma (proposta dal recupero semantico Haiku)
 *  sia DAVVERO presente nel testo — evita falsi positivi da allucinazione.
 *  Confronto case/accent/separator-insensitive. */
function phraseAppearsInText(phrase: string, text: string): boolean {
  const norm = (s: string) => stripAccents(normalizeApostrophes(s).toLowerCase()).replace(SEP_SPLIT, " ").trim();
  const p = norm(phrase);
  if (p.replace(/\s/g, "").length < 2) return false; // troppo corta/generica
  return norm(text).includes(p);
}

/**
 * Build brand name variants for matching:
 * - Full name as-is
 * - Full name with accents stripped
 * - First distinctive word (for multi-word brands like "Costa Crociere" → "Costa")
 * - Common international swaps (Crociere↔Cruises, Gruppo↔Group, etc.)
 */
/** Aggiunge a `variants` (e a `partials` per i match monoparola) le forme di UN
 *  nome — il brand principale o un suo alias. Il match separator-insensitive è
 *  applicato dopo, in detectBrandMention: qui NON serve enumerare trattino/spazio.
 *  `allowFirstWord` genera la variante "prima parola" solo per il brand
 *  principale (gli alias sono espliciti e matchano per intero). */
function addCoreVariants(variants: Set<string>, partials: Set<string>, name: string, allowFirstWord: boolean): void {
  const clean = normalizeApostrophes(name.trim());
  if (!clean) return;

  // Full name
  variants.add(clean.toLowerCase());
  variants.add(stripAccents(clean).toLowerCase());

  // Apostrophe-tolerant variants (McDonald's / Mcdonalds / L Oreal).
  if (clean.includes("'")) {
    const noApostrophe = clean.replace(/'/g, "");
    variants.add(noApostrophe.toLowerCase());
    variants.add(stripAccents(noApostrophe).toLowerCase());

    const apostropheToSpace = clean.replace(/'/g, " ").replace(/\s+/g, " ").trim();
    if (apostropheToSpace) {
      variants.add(apostropheToSpace.toLowerCase());
      variants.add(stripAccents(apostropheToSpace).toLowerCase());
    }
  }

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

  // Handle "&" / "and" / "e" variations: "Dolce & Gabbana" ↔ "Dolce and Gabbana"
  if (clean.includes("&")) {
    variants.add(clean.replace(/\s*&\s*/g, " and ").toLowerCase());
    variants.add(clean.replace(/\s*&\s*/g, " e ").toLowerCase());
  }
  if (/\band\b/i.test(clean)) {
    variants.add(clean.replace(/\band\b/gi, "&").toLowerCase());
  }

  // Generic category suffixes (e.g. "Giesse Risarcimento Danni") → distinctive prefix.
  const distinctivePrefix = extractDistinctivePrefix(clean);
  if (distinctivePrefix) {
    variants.add(distinctivePrefix.toLowerCase());
    variants.add(stripAccents(distinctivePrefix).toLowerCase());
  }

  // First distinctive word for multi-word brands (whitespace split only, so
  // hyphenated single tokens like "Audio-Technica" do NOT spawn a risky
  // "audio" partial). Tracked in `partials` so the caller can apply weaker
  // trust to first-word-only matches.
  if (allowFirstWord) {
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      const firstWord = words[0];
      if (firstWord.length >= 3 && !BRAND_GENERIC_WORDS.has(firstWord.toLowerCase())) {
        const fw = firstWord.toLowerCase();
        const fwn = stripAccents(firstWord).toLowerCase();
        variants.add(fw); partials.add(fw);
        variants.add(fwn); partials.add(fwn);
      }
    }
  }

  // Forma completamente attaccata, senza separatori ("Audio-Technica" →
  // "audiotechnica"). Solo se il nome ha ≥2 parti ed è lungo e distintivo
  // (≥12 char), per evitare collisioni con parole comuni ("Pro Ject" →
  // "project"). Le forme più corte le recupera comunque l'analisi semantica.
  const collapsed = stripAccents(clean.replace(SEP_SPLIT, "")).toLowerCase();
  const nParts = clean.split(SEP_SPLIT).filter(Boolean).length;
  if (nParts >= 2 && collapsed.length >= 12 && !BRAND_GENERIC_WORDS.has(collapsed)) {
    variants.add(collapsed);
  }
}

/**
 * Build brand name variants for matching, plus any user-provided aliases
 * (e.g. "P&G" for "Procter & Gamble"). Returns the variant list and the set of
 * first-word "partial" variants (used to apply weaker trust to partial matches).
 */
function buildBrandVariants(brand: string, aliases: string[] = []): { variants: string[]; partials: Set<string> } {
  const variants = new Set<string>();
  const partials = new Set<string>();
  addCoreVariants(variants, partials, brand, true);
  for (const a of aliases) if (a && a.trim()) addCoreVariants(variants, partials, a, false);
  return { variants: Array.from(variants), partials };
}

interface BrandDetection {
  mentioned: boolean;
  occurrences: number;
  matchedVariant: string | null;
  /** "full" = full-name (or swap variant) matched; "partial" = only first-word matched.
   *  Used by extractFromResponse to apply weaker trust to partial matches when
   *  Haiku explicitly denies the brand presence. "none" when not matched. */
  matchType: "full" | "partial" | "none";
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
export function detectBrandMention(response: string, targetBrand: string, aliases: string[] = []): BrandDetection {
  const { variants, partials } = buildBrandVariants(targetBrand, aliases);
  // Partial = solo i match "prima parola" (registrati in `partials`). Alias e
  // nomi completi sono sempre "full".
  const classifyMatch = (variant: string): "full" | "partial" =>
    partials.has(variant) ? "partial" : "full";

  // Normalize curly apostrophes (U+2019 etc.) to ASCII, then replace every
  // apostrophe with a space (McDonald's / Mcdonalds / McDonald s).
  const normalizedResponse = normalizeApostrophes(response).replace(/'/g, " ");
  const cleaned = stripMarkdown(normalizedResponse);
  const responseLower = cleaned.toLowerCase();
  const responseNorm = stripAccents(responseLower);
  const generic = isGenericBrandName(targetBrand);

  // For generic brand names, only try multi-word (or exact full-name) variants:
  // single-token variants like a generic distinctive-prefix ("Casa") would
  // false-positive on everyday text. Precision > recall for generic names.
  const effectiveVariants = generic
    ? variants.filter((v) => v.includes(" ") || v === targetBrand.toLowerCase().trim())
    : variants;

  // Sort: longer variants first (full name before first-word)
  const sorted = effectiveVariants.sort((a, b) => b.length - a.length);

  // Strategy 1: separator-insensitive match on markdown-cleaned text.
  // "Audio-Technica" / "Audio Technica" / "Audio.Technica" match the same brand.
  for (const variant of sorted) {
    const pat = separatorFlexiblePattern(stripAccents(variant));
    if (!pat) continue;
    const matches = responseNorm.match(new RegExp(pat, "gi"));
    if (matches && matches.length > 0) {
      return { mentioned: true, occurrences: matches.length, matchedVariant: variant, matchType: classifyMatch(variant) };
    }
  }

  // Strategy 2: permissive match on the raw response (brand inside formatting).
  const rawLower = stripAccents(normalizedResponse.toLowerCase());
  for (const variant of sorted) {
    const pat = separatorFlexiblePatternLoose(stripAccents(variant));
    if (!pat) continue;
    const matches = rawLower.match(new RegExp(pat, "gi"));
    if (matches && matches.length > 0) {
      return { mentioned: true, occurrences: matches.length, matchedVariant: variant, matchType: classifyMatch(variant) };
    }
  }

  return { mentioned: false, occurrences: 0, matchedVariant: null, matchType: "none" };
}

/** Check if a brand name is composed of generic/common words that could cause false positives */
function isGenericBrandName(brand: string): boolean {
  const GENERIC = BRAND_GENERIC_WORDS;
  // Strip accents before lookup so accented variants of generic words
  // (e.g. "Caffè" → "caffe") match the generic set, which is stored
  // accent-free. Without this, "Caffè" would pass through as a distinctive
  // brand and trigger false positives on everyday Italian text.
  const words = stripAccents(brand.toLowerCase().trim()).split(/\s+/);
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

/** Match deterministico fonte↔dominio del brand: il "sito tuo" non si affida a
 *  Haiku, si riconosce confrontando i domini normalizzati. */
/**
 * Il dominio della fonte e' del brand analizzato?
 * Esportata il 10/09/2026: serve anche a chi SALVA le fonti (lib/inngest-functions),
 * che prima derivava is_brand_owned dalla sola etichetta del modello. Una seconda
 * copia della regola sarebbe divergata al primo ritocco.
 */
export function domainMatchesBrand(domain?: string | null, brandDomain?: string | null): boolean {
  if (!domain || !brandDomain) return false;
  const norm = (d: string) =>
    d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase().trim();
  const a = norm(domain), b = norm(brandDomain);
  if (!a || !b || b.length < 4) return false;
  // Solo uguaglianza esatta o sottodominio del brand. Il vecchio match fuzzy
  // (a.includes(b) || b.includes(a)) marcava brand_owned per errore su domini
  // corti/generici (es. un dominio terzo che contiene la stringa del brand).
  return a === b || a.endsWith("." + b);
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

// Piattaforme/social: MAI competitor di nessun brand (sono canali). Esclusione
// universale, valida per ogni settore.
const PLATFORM_EXCLUSION =
  "Never include social platforms or channels (TikTok, Instagram, YouTube, Facebook, X/Twitter, LinkedIn, Reddit, Pinterest, Threads, Twitch) as competitors — they are distribution channels, not competitors.";

/** Sector-aware guidance for competitor extraction. Generale per qualsiasi brand:
 *  il tipo dei competitor deriva dalla NATURA del brand (settore/brand_type). */
function getSectorCompetitorGuidance(sector?: string, brandType?: string): string {
  const s = (sector ?? "").toLowerCase();
  const bt = (brandType ?? "").toLowerCase();

  // Media / editori / content creator / agenzie di contenuto: i competitor sono
  // ALTRI creator/media/blog dello stesso ambito, NON i locali, prodotti, aziende
  // o eventi che coprono o recensiscono (quelli sono SOGGETTI, non competitor).
  const MEDIA_HINTS = [
    "news", "editoria", "portali", "media", "giornal", "magazine", "rivista",
    "blog", "creator", "content", "contenut", "influencer", "publisher",
    "informativ", "marketing", "comunicazione", "communication", "divulgaz",
  ];
  const isMediaCreator = MEDIA_HINTS.some((k) => s.includes(k))
    || ["creator", "media", "publisher", "influencer", "blog"].some((k) => bt.includes(k));
  if (isMediaCreator) {
    return [
      `This brand is a content creator / publisher / media outlet (sector: "${sector ?? "generic"}").`,
      `Valid competitors are ONLY OTHER content creators, bloggers, influencers, online magazines, blogs, channels and media outlets in the SAME niche.`,
      `Do NOT list the venues, restaurants, bars, hotels, shops, products, physical businesses, places or events they cover, review, recommend or feature — those are SUBJECTS of the content, NOT competitors.`,
      `Do NOT list influencer-marketing platforms, creator marketplaces, talent agencies, creator databases or analytics tools (e.g. tools used to FIND, hire or measure creators) — those are TOOLS, not creators.`,
      PLATFORM_EXCLUSION,
    ].join(" ");
  }

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

  return `For this sector (${sector ?? "generic"}), valid competitors are: ${validTypes}. ${PLATFORM_EXCLUSION}`;
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

interface PartialExtraction extends Pick<ExtractionResult, "topics" | "competitors_found" | "sources"> {
  /** Recupero semantico: il brand è stato riconosciuto sotto alias/variante? */
  brand_present: boolean;
  brand_matched_text: string | null;
  brand_rank: number | null;
  brand_occurrences: number;
  tone_score: number | null;
  recommendation_score: number | null;
  brand_adjectives: string[];
}

const EMPTY_PARTIAL: PartialExtraction = {
  brand_present: false, brand_matched_text: null, brand_rank: null, brand_occurrences: 0,
  tone_score: null, recommendation_score: null, brand_adjectives: [],
  topics: [], competitors_found: [], sources: [],
};

async function extractCompetitorsTopicsSources(
  response: string,
  targetBrand: string,
  sector?: string,
  brandType?: string,
  language?: string,
  brandDomain?: string | null,
  trackingContext?: ExtractTrackingContext,
): Promise<PartialExtraction> {
  // Clean control characters and Perplexity-style citation markers [1], [2], etc.
  // that can confuse Haiku into including them in competitor names
  const cleanResponse = response
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\[(\d{1,2})\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 3000);

  if (!cleanResponse || cleanResponse.length < 50) {
    return { ...EMPTY_PARTIAL };
  }

  const lang = language === "en" ? "English" : language === "fr" ? "French" : language === "de" ? "German" : language === "es" ? "Spanish" : "Italian";
  const langInstr = `IMPORTANT: All extracted topics, labels, and context text MUST be in ${lang} — match the language of the response being analyzed.`;

  const sectorCompetitorGuidance = getSectorCompetitorGuidance(sector, brandType);

  // Split prompt into a STATIC prefix (cacheable for the duration of a run —
  // brand/sector/language/brandType are stable) and a DYNAMIC suffix
  // (the response under analysis, different per call). Anthropic prompt
  // caching: marking the static block with cache_control=ephemeral makes
  // every subsequent call within ~5 min pay only 10% of the input rate on
  // the cached portion. For Haiku this collapses ~$0.0009 → ~$0.0001 per
  // cached call after the first one.
  const staticPrompt = `You are an AI analyst. A deterministic string match did NOT find the brand "${targetBrand}" verbatim in this response, but it MAY still be mentioned under a variant: a different spelling/spacing/hyphenation (e.g. "Audio-Technica" vs "Audio Technica"), an abbreviation or acronym (e.g. "P&G" for "Procter & Gamble", "GSK" for "GlaxoSmithKline", "VW" for "Volkswagen"), or an official alias / parent / common short name.
Sector: ${sector ?? "generic"}
Brand type: ${brandType ?? "manufacturer"}

${langInstr}

Your job: (1) decide whether the SAME company/brand "${targetBrand}" is actually mentioned (under any form), and (2) extract commercial competitors, topics and sources.

${sectorCompetitorGuidance}

Extract:
- brand_present / brand_matched_text: whether "${targetBrand}" (or a genuine alias/abbreviation/spelling variant of the SAME entity) is mentioned, and the exact text that refers to it
- competitors_found: ALL commercial brands/companies/services mentioned that compete with the target brand (do NOT include "${targetBrand}" itself, in any form)
- topics: main topics discussed (in ${lang})
- sources: most relevant sites/domains cited

Respond ONLY with valid JSON. No text before or after JSON.

Required JSON schema:
{
  "brand_present": boolean,
  "brand_matched_text": string | null,
  "brand_rank": number | null,
  "brand_occurrences": number,
  "tone_score": number,
  "recommendation_score": number,
  "brand_adjectives": string[],
  "topics": string[],
  "competitors_found": [{ "name": string, "type": "direct"|"indirect"|"channel"|"aggregator", "rank": number, "sentiment": number, "tone": number, "recommendation": number }],
  "sources": [{ "url": string|null, "domain": string, "label": string|null, "source_type": string, "is_brand_owned": boolean, "context": string }]
}

BRAND PRESENCE RULES:
- brand_present: true ONLY if the SAME entity "${targetBrand}" is mentioned (verbatim, or via a genuine spelling variant / abbreviation / official alias). Do NOT set true for merely similar names or for competitors.
- brand_matched_text: the EXACT substring, copied verbatim from the response, that refers to the brand (must literally appear in the text). null if brand_present=false.
- brand_rank: position of the brand's first mention among distinct brands (1 = first). null if not present.
- brand_occurrences: how many times the brand appears (0 if absent).
- tone_score / recommendation_score: sentiment [-1.0..+1.0] and recommendation [-1.0..+1.0] toward the brand (0 if absent).
- brand_adjectives: 2-3 adjectives describing the brand (in ${lang}); [] if absent.

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
source_type: media|review|ecommerce|social|competitor|wikipedia|other`;

  const dynamicSuffix = `

Analyze this response:

${cleanResponse}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const haikuCall = () => anthropic.messages.create({
      model: HAIKU_API_MODEL,
      max_tokens: 2000,
      // Deterministic extraction: temperature 0 so identical responses always
      // yield identical structured data (stable AVI scores, reproducible debug).
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
            { type: "text", text: dynamicSuffix },
          ] as any,
        },
      ],
    });
    const message = trackingContext
      ? await trackedAICall(
          { ...trackingContext, provider: "anthropic", apiModel: HAIKU_API_MODEL, operation: "avi_extractor" },
          haikuCall,
        )
      : await haikuCall();

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
      brand_present: parsed.brand_present === true,
      brand_matched_text: typeof parsed.brand_matched_text === "string" ? parsed.brand_matched_text : null,
      brand_rank: parsed.brand_rank != null ? Number(parsed.brand_rank) : null,
      brand_occurrences: Number(parsed.brand_occurrences) || 0,
      tone_score: parsed.tone_score != null ? Math.max(-1, Math.min(1, Number(parsed.tone_score))) : null,
      recommendation_score: parsed.recommendation_score != null ? Math.max(-1, Math.min(1, Number(parsed.recommendation_score))) : null,
      brand_adjectives: Array.isArray(parsed.brand_adjectives) ? parsed.brand_adjectives : [],
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
          ? parsed.sources.map((s: any) => {
              const brandOwned = domainMatchesBrand(s.domain, brandDomain) || Boolean(s.is_brand_owned);
              return {
                url: s.url ?? null,
                domain: s.domain ?? null,
                label: s.label ?? null,
                source_type: brandOwned ? "brand_owned" : (VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other"),
                is_brand_owned: brandOwned,
                context: s.context ?? null,
              };
            })
          : [],
        response,
      ),
    };
  } catch (e) {
    console.error("[extractor] partial extraction failed:", e);
    return { ...EMPTY_PARTIAL };
  }
}

/**
 * Optional tracking context for the Haiku extractor calls inside this module.
 * When provided, each anthropic.messages.create() call writes a row to
 * api_call_logs with operation = "avi_extractor".
 */
export interface ExtractTrackingContext {
  product: "avi" | "brand_profile" | "cs";
  userId?: string | null;
  userEmail?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  runId?: string | null;
  promptId?: string | null;
  meta?: Record<string, unknown>;
}

export async function extractFromResponse(
  response: string,
  targetBrand: string,
  sector?: string,
  brandType?: string,
  language?: string,
  brandDomain?: string | null,
  trackingContext?: ExtractTrackingContext,
  aliases: string[] = [],
): Promise<ExtractionResult> {
  // Robust brand detection with variants, separator-insensitive matching and aliases
  const detection = detectBrandMention(response, targetBrand, aliases);

  console.log(`[extractor] brand="${targetBrand}" detected=${detection.mentioned} occurrences=${detection.occurrences} variant="${detection.matchedVariant}" responseLen=${response.length} preview="${response.substring(0, 150).replace(/\n/g, " ")}"`);

  // If brand not present, use a lighter prompt for competitors/topics/sources only
  if (!detection.mentioned) {
    const partialResult = await extractCompetitorsTopicsSources(
      response, targetBrand, sector, brandType, language, brandDomain, trackingContext
    );

    // RECUPERO SEMANTICO (B): la regex non ha trovato il brand, ma l'estrattore
    // semantico può averlo riconosciuto sotto una variante/alias non colta
    // (es. "P&G" per "Procter & Gamble"). Accettiamo il match SOLO se la forma
    // restituita è DAVVERO presente nel testo (anti-allucinazione) e il brand
    // non è un nome generico (troppo rischio di falso positivo).
    if (
      !isGenericBrandName(targetBrand) &&
      partialResult.brand_present &&
      partialResult.brand_matched_text &&
      phraseAppearsInText(partialResult.brand_matched_text, response)
    ) {
      const toneScore = partialResult.tone_score ?? 0;
      const recScore = partialResult.recommendation_score ?? 0;
      const sentimentFinal = Math.max(-1, Math.min(1, (toneScore * 0.6) + (recScore * 0.4)));
      console.log(`[extractor] RECUPERO semantico: brand="${targetBrand}" riconosciuto come "${partialResult.brand_matched_text}" (regex mancata)`);
      return {
        brand_mentioned: true,
        brand_rank: partialResult.brand_rank ?? null,
        brand_occurrences: partialResult.brand_occurrences || 1,
        sentiment_score: sentimentFinal,
        tone_score: toneScore,
        position_score: positionScore(partialResult.brand_rank ?? null, partialResult.competitors_found.length),
        recommendation_score: recScore,
        brand_adjectives: partialResult.brand_adjectives ?? [],
        topics: partialResult.topics,
        competitors_found: partialResult.competitors_found,
        sources: partialResult.sources,
      };
    }

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

  const sectorGuidance = getSectorCompetitorGuidance(sector, brandType);

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
- tone_score: language sentiment toward the brand on the CONTINUOUS scale [-1.0, +1.0] with 0.1 granularity. Identify 2-3 key adjectives from the actual text first, then score.
  Calibration anchors (use ALL of the scale, including negative values):
    +0.9..+1.0  unanimously celebrated, iconic, market leader ('iconic, outstanding, top choice')
    +0.6..+0.8  clearly positive ('excellent, reliable, well-regarded')
    +0.3..+0.5  moderately positive ('decent, solid, a good option')
    +0.1..+0.2  faintly positive ('mentioned among alternatives, neutral-positive')
     0.0        purely neutral / descriptive only, no qualitative judgement
    -0.1..-0.2  faintly negative ('mentioned but with reservations, dated, niche')
    -0.3..-0.5  moderately negative ('underwhelming, overpriced, behind competitors')
    -0.6..-0.8  clearly negative ('problematic, criticized, declining, troubled')
    -0.9..-1.0  strongly negative ('scandal, lawsuit, dangerous, avoid')
  DO NOT cluster around +0.5 or +0.6 as a safe default. If the text is purely factual/descriptive, return 0.0. If criticisms are present, USE NEGATIVE VALUES. If brand_mentioned=false → 0.0.
- brand_adjectives: 2-3 key adjectives describing brand (in ${lang}). Empty if not mentioned.
- recommendation_score: how strongly the response RECOMMENDS the brand on the CONTINUOUS scale [-1.0, +1.0] with 0.1 granularity. This measures explicit endorsement, NOT sentiment (use tone_score for that).
  Calibration anchors (use the FULL range, not just 0 / 0.5 / 1):
    +0.9..+1.0  explicitly named as the #1 choice or 'best option' ('we strongly recommend X', 'X is the clear winner')
    +0.6..+0.8  recommended with enthusiasm but among other good options ('X is one of the top picks')
    +0.3..+0.5  positively mentioned without explicit recommendation ('X is a solid choice', 'X works well')
    +0.1..+0.2  mentioned in a list of options with mildly favorable framing
     0.0        cited as factual information only, no recommendation either way
    -0.1..-0.2  cited with mild caveats ('X exists but consider alternatives')
    -0.3..-0.5  cited unfavorably or as a weaker option ('X is outdated', 'X is not ideal')
    -0.6..-0.8  explicitly advised against ('avoid X for this use case', 'X has serious limitations')
    -0.9..-1.0  strongly discouraged ('never use X', 'X is dangerous/illegal/scam')
  DO NOT default to 0.5 when uncertain — return 0.0 if there is no recommendation signal. If brand_mentioned=false → 0.0.
- topics: main topics discussed (in ${lang})
- competitors_found: name, type (direct|indirect|channel|aggregator), rank (1=first cited), sentiment (-1.0/+1.0), tone (0.0 to 1.0: language positivity), recommendation (1.0=strongly recommended, 0.5=neutral, 0.0=not recommended)

CRITICAL: If brand_mentioned=true, brand_rank/tone_score/recommendation_score are MANDATORY (cannot be null).

Competitor types: DIRECT=same product+market, INDIRECT=different product same need, CHANNEL=distribution, AGGREGATOR=comparison/discovery platforms.
Use sector and brand type to infer type. Include ALL cited entities — every brand cited instead of target has strategic relevance.

${competitorExclusionRules}

SOURCES — extract ONLY URLs/domains LITERALLY written in the response text. Do NOT infer domains from brand names. If no explicit URLs appear, return "sources": [].
source_type: media|review|ecommerce|social|competitor|wikipedia|other`;

  // Same caching strategy as extractCompetitorsTopicsSources above.
  // systemPrompt is stable for the duration of a run (depends on
  // language/sector/brandType which don't change between prompts of the
  // same project), so marking it cache_control=ephemeral lets every call
  // after the first within ~5 min pay only 10% of the cached input rate.
  const cleanedResponse = response.replace(/\[(\d{1,2})\]/g, "").replace(/\s{2,}/g, " ").slice(0, 3000);
  const dynamicSuffix = `\n\nAnalizza questa risposta:\n\n${cleanedResponse}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const haikuCall = () => anthropic.messages.create({
    model: HAIKU_API_MODEL,
    max_tokens: 2000,
    // Deterministic extraction: temperature 0 so identical responses always
    // yield identical structured data (stable AVI scores, reproducible debug).
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          { type: "text", text: dynamicSuffix },
        ] as any,
      },
    ],
  });
  const message = trackingContext
    ? await trackedAICall(
        { ...trackingContext, provider: "anthropic", apiModel: HAIKU_API_MODEL, operation: "avi_extractor" },
        haikuCall,
      )
    : await haikuCall();

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

    // Use robust detection result for brand_mentioned, but trust Haiku's
    // semantic denial when our regex match is only a weak partial (first-word
    // only). This eliminates FP like "Health & Her" matching every "health"
    // in a wellness response while preserving recall on legitimate brands
    // whose first word is distinctive (e.g. "Pitagora s.p.a." -> "Pitagora").
    const haikuExplicitlyDenied = parsed.brand_mentioned === false;
    const isWeakPartialMatch = detection.matchType === "partial";
    const brandMentioned = (isWeakPartialMatch && haikuExplicitlyDenied)
      ? false
      : detection.mentioned;
    if (detection.mentioned && !brandMentioned) {
      console.log(`[extractor] FIX#3 override: regex partial-match "${detection.matchedVariant}" rejected by Haiku denial for brand="${targetBrand}"`);
    }

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
          ? parsed.sources.map((s: any) => {
              const brandOwned = domainMatchesBrand(s.domain, brandDomain) || Boolean(s.is_brand_owned);
              return {
                url: s.url ?? null,
                domain: s.domain ?? null,
                label: s.label ?? null,
                source_type: brandOwned ? "brand_owned" : (VALID_SOURCE_TYPES.includes(s.source_type) ? s.source_type : "other"),
                is_brand_owned: brandOwned,
                context: s.context ?? null,
              };
            })
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

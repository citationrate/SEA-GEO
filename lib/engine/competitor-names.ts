/**
 * Canonical competitor name normalization.
 * Prevents duplicates like "Arc'teryx" vs "Arcteryx", "De'Longhi" vs "Delonghi", etc.
 * Applied at extraction time AND before every DB insert/upsert.
 */

const CANONICAL_MAP: Record<string, string> = {
  "arcteryx": "Arc'teryx",
  "nespresso": "Nespresso",
  "illy": "Illy",
  "delonghi": "De'Longhi",
  "asics": "ASICS",
  "asos": "ASOS",
  "puma": "PUMA",
  "7up": "7UP",
  "7 up": "7UP",
  "acquatonica": "Acqua Tonica",
  "footlocker": "Foot Locker",
  "fuzetea": "FuzeTea",
  "giallozafferano": "Giallo Zafferano",
  "grancereale": "Gran Cereale",
  "sanpellegrino": "San Pellegrino",
  "pastadigragnano": "Pasta di Gragnano",
};

/**
 * Runtime dedup cache: maps normalized keys to the first canonical form seen.
 * This ensures "Studio 3A" and "Studio3A" resolve to the same display name
 * even without a CANONICAL_MAP entry.
 */
const RUNTIME_CANON = new Map<string, string>();

/**
 * Known brand names — used to extract just the parent brand from full product names.
 * e.g. "Samsung Galaxy S24 Ultra" → "Samsung"
 */
const KNOWN_BRANDS = new Set([
  "samsung", "apple", "google", "microsoft", "dell", "hp", "lenovo", "asus",
  "acer", "sony", "lg", "huawei", "xiaomi", "oppo", "vivo", "oneplus",
  "realme", "motorola", "nokia", "honor", "nothing", "razer", "msi",
  "gigabyte", "corsair", "logitech", "bose", "jbl", "sennheiser",
  "garmin", "fitbit", "amazfit", "suunto", "polar", "coros",
  "dyson", "philips", "braun", "bosch", "siemens", "miele", "electrolux",
  "whirlpool", "kitchenaid", "smeg", "bialetti", "tefal", "moulinex",
  "nike", "adidas", "puma", "reebok", "new balance", "asics", "under armour",
  "north face", "patagonia", "columbia", "timberland", "vans", "converse",
  "gucci", "prada", "louis vuitton", "chanel", "dior", "versace", "armani",
  "balenciaga", "fendi", "burberry", "hermes", "valentino", "bottega veneta",
  "tesla", "bmw", "mercedes", "audi", "volkswagen", "toyota", "honda",
  "ford", "chevrolet", "hyundai", "kia", "volvo", "porsche", "ferrari",
  "lamborghini", "maserati", "alfa romeo", "fiat", "jeep", "land rover",
  "jaguar", "mazda", "nissan", "subaru", "lexus", "infiniti", "genesis",
  "amazon", "ebay", "alibaba", "zalando", "asos", "shein",
  "netflix", "spotify", "disney", "hbo", "paramount",
  "meta", "tiktok", "snapchat", "pinterest", "reddit", "twitter",
  "oracle", "sap", "salesforce", "adobe", "ibm", "intel", "amd", "nvidia",
  "qualcomm", "broadcom", "cisco", "vmware", "shopify", "stripe",
]);

/**
 * Product suffixes to strip when extracting brand-only names.
 */
const PRODUCT_SUFFIXES = /\b(ultra|pro|max|plus|mini|air|se|lite|neo|edge|fold|flip|tab|note|buds?|pods?|watch|band|fit|studio|book|pad|pixel|surface|galaxy|xps|thinkpad|ideapad|zenbook|vivobook|proart|studiobook|macbook|iphone|ipad|imac|series|edition|generation|gen\s*\d+|\d{1,2}[.]?\d*\s*(inch|"|')|oled|amoled|lcd|hdr|\d{2,4}\s*(ultra|pro|max|plus|mini|se|lite)?)\b/gi;

/**
 * Extract only the parent brand/company name from a full product name.
 * e.g. "Samsung Galaxy S24 Ultra" → "Samsung"
 *      "Asus ProArt Studiobook 16 OLED" → "Asus"
 *      "Google Pixel Watch 4" → "Google"
 */
export function extractBrandOnly(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  // Check if first word (or first two words) is a known brand
  const words = trimmed.split(/\s+/);
  const firstWordLower = words[0].toLowerCase();
  const firstTwoLower = words.length > 1 ? `${words[0]} ${words[1]}`.toLowerCase() : "";

  // Check two-word brands first (e.g. "New Balance", "North Face", "Land Rover")
  if (firstTwoLower && KNOWN_BRANDS.has(firstTwoLower)) {
    return `${words[0]} ${words[1]}`;
  }

  // Check single-word brands
  if (KNOWN_BRANDS.has(firstWordLower) && words.length > 1) {
    return words[0];
  }

  // Not a known brand — try stripping product suffixes and model numbers
  let cleaned = trimmed
    .replace(PRODUCT_SUFFIXES, "")
    .replace(/\s+\d[\w.-]*$/g, "")  // trailing model numbers like "S24", "16", "4"
    .replace(/\s{2,}/g, " ")
    .trim();

  // If stripping removed everything or left just 1-2 chars, keep original
  if (!cleaned || cleaned.length < 2) return trimmed;

  return cleaned;
}

export function canonicalizeCompetitorName(name: string): string {
  const normalized = name.trim().replace(/\s{2,}/g, " ");

  const key = normalized
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "");

  // 1. Explicit canonical map has highest priority
  if (CANONICAL_MAP[key]) return CANONICAL_MAP[key];

  // 2. Runtime dedup: if we've seen this key before, reuse the canonical form
  const existing = RUNTIME_CANON.get(key);
  if (existing) {
    // Keep the longer/more readable version (usually the one with spaces)
    if (normalized.length > existing.length) {
      RUNTIME_CANON.set(key, normalized);
      return normalized;
    }
    return existing;
  }

  // 3. First time seeing this key — register it
  RUNTIME_CANON.set(key, normalized);
  return normalized;
}

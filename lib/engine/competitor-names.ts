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

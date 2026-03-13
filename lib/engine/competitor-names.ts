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

export function canonicalizeCompetitorName(name: string): string {
  const normalized = name.trim();

  const key = normalized
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "");

  return CANONICAL_MAP[key] ?? normalized;
}

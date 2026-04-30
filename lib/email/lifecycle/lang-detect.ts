/**
 * Detection lingua per lifecycle emails.
 * Chain: profiles.lang → raw_user_meta_data.lang → AVI project country → email TLD → IT default.
 *
 * Lingue supportate per ora: 'it', 'en'. Le altre (fr, de, es) seguono.
 */

export type SupportedLang = "it" | "en";

interface DetectInput {
  email: string;
  profileLang?: string | null;
  authMetaLang?: string | null;
  aviProjectCountry?: string | null;
}

export function detectLang(input: DetectInput): SupportedLang {
  // 1. Esplicito profilo
  if (input.profileLang) {
    const norm = normalize(input.profileLang);
    if (norm) return norm;
  }
  // 2. Esplicito auth metadata
  if (input.authMetaLang) {
    const norm = normalize(input.authMetaLang);
    if (norm) return norm;
  }
  // 3. AVI project country (string text)
  if (input.aviProjectCountry) {
    const c = input.aviProjectCountry.toLowerCase();
    if (c.includes("ital")) return "it";
    if (c.includes("kingdom") || c.includes("united states") || c.includes("usa") || c.includes("global") || c.includes("worldwide"))
      return "en";
  }
  // 4. Email TLD
  const tld = (input.email.split("@")[1] || "").toLowerCase();
  if (tld.endsWith(".it") || tld.includes("studenti.iulm")) return "it";
  if (tld.endsWith(".uk") || tld.endsWith(".co.uk") || tld.endsWith(".us")) return "en";
  // 5. Default
  return "it";
}

function normalize(raw: string): SupportedLang | null {
  const s = raw.toLowerCase().slice(0, 2);
  if (s === "it") return "it";
  if (s === "en") return "en";
  return null;
}

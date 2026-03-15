import { translations, type Locale } from "./translations";

/**
 * Server-side translation helper.
 * Use in API routes and server components where React context is unavailable.
 */
export function getServerTranslator(locale: Locale = "it") {
  return function t(key: string): string {
    const keys = key.split(".");
    let val: any = translations[locale];
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) break;
    }
    if (typeof val === "string") return val;
    // Fallback to Italian
    let fallback: any = translations.it;
    for (const k of keys) {
      fallback = fallback?.[k];
      if (fallback === undefined) break;
    }
    return typeof fallback === "string" ? fallback : key;
  };
}

/**
 * Extract locale from request (query param `lang` or Accept-Language header).
 */
export function getLocaleFromRequest(request: Request): Locale {
  const url = new URL(request.url);
  const langParam = url.searchParams.get("lang");
  if (langParam && langParam in translations) return langParam as Locale;

  const acceptLang = request.headers.get("accept-language") ?? "";
  const supported: Locale[] = ["it", "en", "fr", "de", "es"];
  for (const s of supported) {
    if (acceptLang.includes(s)) return s;
  }
  return "it";
}

/**
 * Cross-subdomain user preferences (theme + locale) shared between
 * suite.citationrate.com (CR) and avi.citationrate.com (AVI/BP).
 *
 * Cookies:
 *   cr-theme   — "light" | "dark"
 *   cr-locale  — "it" | "en" | "fr" | "de" | "es"
 *
 * On *.citationrate.com hosts the cookie is written with `Domain=.citationrate.com`
 * so both apps share the same value. On localhost/preview it falls back to the
 * current host (no Domain attr).
 */

export const CR_THEME_COOKIE = "cr-theme";
export const CR_LOCALE_COOKIE = "cr-locale";

export const CR_PREF_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const SHARED_DOMAIN = ".citationrate.com";

function isSharedHost(host: string): boolean {
  // Match foo.citationrate.com or citationrate.com
  return host === "citationrate.com" || host.endsWith(".citationrate.com");
}

function writeCookie(name: string, value: string, opts?: { maxAge?: number }) {
  if (typeof document === "undefined") return;
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const maxAge = opts?.maxAge ?? CR_PREF_MAX_AGE;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (isSharedHost(host)) parts.push(`Domain=${SHARED_DOMAIN}`);
  if (isSecure) parts.push("Secure");
  document.cookie = parts.join("; ");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const re = new RegExp(`(?:^|; )${name.replace(/[-]/g, "\\-")}=([^;]*)`);
  const m = document.cookie.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

export function writeThemeCookie(theme: "light" | "dark") {
  writeCookie(CR_THEME_COOKIE, theme);
}

export function readThemeCookie(): "light" | "dark" | null {
  const v = readCookie(CR_THEME_COOKIE);
  return v === "light" || v === "dark" ? v : null;
}

export function writeLocaleCookie(locale: string) {
  writeCookie(CR_LOCALE_COOKIE, locale);
}

export function readLocaleCookie(): string | null {
  return readCookie(CR_LOCALE_COOKIE);
}

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Locale } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LS_KEY = "seageo-lang";
const COOKIE_KEY = "avi-locale";
// One year, in seconds. Server components read this cookie to know the user's
// locale (the localStorage value is invisible to SSR).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeLocaleCookie(l: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=${l}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`),
  );
  const v = match?.[1];
  return v && v in translations ? (v as Locale) : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("it");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored =
      (localStorage.getItem(LS_KEY) as Locale | null) || readLocaleCookie();
    if (stored && stored in translations) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
      // Backfill cookie if the user only had localStorage (returning user
      // before this change shipped).
      writeLocaleCookie(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LS_KEY, l);
    writeLocaleCookie(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string): string => {
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
    },
    [locale],
  );

  // Until mounted, render with the default locale ("it") so SSR and first
  // client render match — prevents React hydration mismatch when localStorage
  // holds a different locale.
  return (
    <I18nContext.Provider value={{ locale: mounted ? locale : "it", setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? "it";
}

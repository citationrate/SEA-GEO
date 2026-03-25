"use client";

import { useTranslation } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/translations";
import { Globe } from "lucide-react";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "it", label: "Italiano", flag: "IT" },
  { code: "en", label: "English", flag: "EN" },
  { code: "fr", label: "Français", flag: "FR" },
  { code: "de", label: "Deutsch", flag: "DE" },
  { code: "es", label: "Español", flag: "ES" },
];

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent border border-border rounded-[2px] px-1.5 sm:px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";

export function TopBar() {
  return (
    <header
      className="h-12 flex-shrink-0 border-b border-border px-6 flex items-center justify-end gap-3"
      style={{ background: "var(--surface)", backdropFilter: "blur(8px)" }}
    >
      <LanguageSelector />
      <ThemeToggle />
    </header>
  );
}

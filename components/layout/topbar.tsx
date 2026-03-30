"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { Menu, ExternalLink } from "lucide-react";
import { useMobileNav } from "./mobile-nav-context";
import { useTranslation } from "@/lib/i18n/context";

export function TopBar() {
  const { toggle } = useMobileNav();
  const { t } = useTranslation();

  return (
    <header
      className="h-12 flex-shrink-0 border-b border-border px-3 md:px-6 flex items-center justify-between md:justify-end gap-3"
      style={{ background: "var(--surface)", backdropFilter: "blur(8px)" }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={toggle}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors -ml-1"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">
        <a
          href="https://suite.citationrate.com/dashboard"
          className="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[2px] transition-colors"
          style={{ color: "var(--c-sage)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--c-sage-bg)"; e.currentTarget.style.color = "var(--c-cream)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--c-sage)"; }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("sidebar.switchTool")}
        </a>
        <LanguageSelector />
        <ThemeToggle />
      </div>
    </header>
  );
}

"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { Menu } from "lucide-react";
import { useMobileNav } from "./mobile-nav-context";

export function TopBar() {
  const { toggle } = useMobileNav();

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
        <LanguageSelector />
        <ThemeToggle />
      </div>
    </header>
  );
}

"use client";

import { MessageSquareText } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useConsultation } from "@/lib/consultation-context";

export function TopBar() {
  const { openModal } = useConsultation();

  return (
    <header
      className="h-12 flex-shrink-0 border-b border-border px-6 flex items-center justify-end gap-3"
      style={{ background: "var(--surface)", backdropFilter: "blur(8px)" }}
    >
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#c4a882] border border-[#c4a882]/30 px-2.5 py-1.5 rounded-[2px] hover:bg-[#c4a882]/10 transition-colors"
      >
        <MessageSquareText className="w-3.5 h-3.5" />
        Richiedi consulenza
      </button>
      <LanguageSelector />
      <ThemeToggle />
    </header>
  );
}

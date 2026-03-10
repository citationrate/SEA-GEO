"use client";

import { Bell, Search } from "lucide-react";

interface TopBarProps {
  profile: { full_name?: string | null } | null;
}

export function TopBar({ profile: _ }: TopBarProps) {
  return (
    <header className="h-14 flex-shrink-0 border-b border-border bg-ink-2 px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 bg-ink-3 border border-border rounded-sm px-3 py-1.5 w-72 focus-within:border-sage-dim transition-colors">
        <Search className="w-3.5 h-3.5 text-cream-dim flex-shrink-0" />
        <input
          placeholder="Cerca progetti, query..."
          className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-cream-dim focus:outline-none"
        />
        <kbd className="font-mono text-[10px] text-cream-dim bg-ink border border-border rounded-sm px-1.5 py-0.5">⌘K</kbd>
      </div>

      <button className="relative w-8 h-8 flex items-center justify-center rounded-sm text-cream-dim hover:text-foreground hover:bg-ink-3 transition-colors">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
      </button>
    </header>
  );
}

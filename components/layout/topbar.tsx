"use client";

import { Bell, Search } from "lucide-react";

interface TopBarProps {
  profile: { full_name?: string | null } | null;
}

export function TopBar({ profile: _ }: TopBarProps) {
  return (
    <header className="h-14 flex-shrink-0 border-b border-border bg-surface px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-1.5 w-72 focus-within:border-primary/40 transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          placeholder="Cerca progetti, query..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <kbd className="text-[10px] text-muted-foreground bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </div>

      <button className="relative w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
      </button>
    </header>
  );
}

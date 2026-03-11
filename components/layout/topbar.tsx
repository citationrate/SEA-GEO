"use client";

import { Search } from "lucide-react";

interface TopBarProps {
  profile: { full_name?: string | null } | null;
}

export function TopBar({ profile: _ }: TopBarProps) {
  return (
    <header
      className="h-12 flex-shrink-0 border-b border-border px-6 flex items-center justify-between gap-4"
      style={{ background: "rgba(11,13,15,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-center gap-2 border border-border rounded-[2px] px-3 py-1.5 w-72 focus-within:border-primary-hover transition-colors" style={{ background: "var(--surface)" }}>
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          placeholder="Cerca progetti, query..."
          className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <kbd className="font-mono text-[0.6rem] text-muted-foreground border border-border rounded-[2px] px-1.5 py-0.5" style={{ background: "var(--background)" }}>⌘K</kbd>
      </div>
    </header>
  );
}

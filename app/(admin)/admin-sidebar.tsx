"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, Users, FolderOpen, Activity,
  Swords, Trophy, Server, ScrollText, Settings, Shield,
} from "lucide-react";

const NAV = [
  {
    group: "Principale",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Utenti", href: "/admin/utenti", icon: Users },
      { label: "Progetti", href: "/admin/progetti", icon: FolderOpen },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { label: "Analisi Runs", href: "/admin/analisi", icon: Activity },
      { label: "Confronti AI", href: "/admin/confronti", icon: Swords },
      { label: "Competitor", href: "/admin/competitor", icon: Trophy },
    ],
  },
  {
    group: "Sistema",
    items: [
      { label: "Sistema", href: "/admin/sistema", icon: Server },
      { label: "Log Attivit\u00e0", href: "/admin/log", icon: ScrollText },
    ],
  },
  {
    group: "Config",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "var(--background)" }}>
      <div className="h-12 flex items-center gap-2.5 px-3 border-b border-border flex-shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[2px] flex items-center justify-center" style={{ background: "rgba(192,97,74,0.15)", border: "1px solid rgba(192,97,74,0.3)" }}>
            <Shield className="w-3.5 h-3.5 text-destructive" />
          </div>
          <span className="font-display text-[22px] text-foreground tracking-tight" style={{ fontWeight: 300 }}>Admin</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5 select-none">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm transition-all duration-100",
                      isActive(item.href)
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                    )}
                    style={isActive(item.href) ? { background: "rgba(126,184,154,0.06)" } : undefined}
                  >
                    <item.icon className={cn("w-[15px] h-[15px] flex-shrink-0", isActive(item.href) ? "text-primary" : "text-muted-foreground")} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
          <svg width="15" height="15" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#7ab89a"/>
            <circle cx="13" cy="10" r="8" fill="white"/>
            <path d="M5 13 C4 19 2 24 0 29 C4 27 9 22 13 17 Z" fill="white"/>
            <circle cx="26" cy="13" r="7" fill="#3d6b52"/>
            <path d="M19 16 C18 21 16 26 13 31 C17 29 22 24 25 19 Z" fill="#3d6b52"/>
          </svg>
          Torna alla Dashboard
        </Link>
      </div>
    </aside>
  );
}

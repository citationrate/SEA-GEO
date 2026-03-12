"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, FolderOpen, Play, BarChart3,
  Users, Link2, Tag, GitCompare, Settings,
  Database, ChevronRight, Layers, Plus,
} from "lucide-react";

const NAV = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"    },
      { href: "/projects",    icon: FolderOpen,      label: "Progetti"     },
    ],
  },
  {
    group: "Analisi",
    items: [
      { href: "/projects/new", icon: Play,            label: "Nuovo Progetto" },
      { href: "/results",     icon: BarChart3,       label: "Risultati"    },
      { href: "/compare",     icon: GitCompare,      label: "Confronto"    },
      { href: "/datasets",    icon: Database,        label: "Dataset"      },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/competitors", icon: Users,           label: "Competitor"   },
      { href: "/sources",     icon: Link2,           label: "Fonti"        },
      { href: "/topics",      icon: Tag,             label: "Topic"        },
    ],
  },
  {
    group: "Sistema",
    items: [
      { href: "/settings",    icon: Settings,        label: "Impostazioni" },
    ],
  },
];

const PRO_ROUTES = new Set(["/compare", "/datasets"]);

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string } | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const isPro = profile?.plan === "pro" || profile?.plan === "agency";

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border" style={{ background: "var(--background)" }}>
      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-border flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-[2px] flex items-center justify-center transition-all group-hover:glow-primary" style={{ background: "var(--primary-glow)", border: "1px solid var(--primary-hover)" }}>
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-display text-[22px] text-foreground tracking-tight" style={{ fontWeight: 300 }}>SeaGeo</span>
        </Link>
      </div>

      {/* Nav */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto py-4 px-2.5 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5 select-none">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const needsPro = PRO_ROUTES.has(item.href);
                const locked = needsPro && !isPro;

                return (
                  <li key={item.href}>
                    <Link
                      href={locked ? `${item.href}?upgrade=1` : item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans transition-all duration-100",
                        locked
                          ? "text-muted-foreground/50 cursor-default"
                          : isActive(item.href)
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                      )}
                      style={isActive(item.href) && !locked ? { background: "rgba(126,184,154,0.06)" } : undefined}
                    >
                      <item.icon className={cn(
                        "w-[15px] h-[15px] flex-shrink-0",
                        locked ? "text-muted-foreground/40" : isActive(item.href) ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/projects" && !locked && (
                        <Link
                          href="/projects/new"
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Nuovo Progetto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {locked && (
                        <span className="font-mono text-[0.5rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">PRO</span>
                      )}
                      {isActive(item.href) && !locked && item.href !== "/projects" && (
                        <ChevronRight className="w-3 h-3 text-primary/50" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile → links to settings */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] hover:bg-surface-2 transition-colors"
        >
          <div className="w-6 h-6 rounded-[2px] flex items-center justify-center flex-shrink-0 text-primary font-mono text-xs" style={{ background: "var(--primary-glow)" }}>
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate leading-tight font-sans">
              {profile?.full_name ?? profile?.email ?? "Utente"}
            </p>
            <p className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-wide">
              Piano {profile?.plan ?? "free"}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

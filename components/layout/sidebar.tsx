"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, FolderOpen, Play, BarChart3,
  Users, Link2, Tag, GitCompare, Settings,
  Database, ChevronRight, Layers,
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

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string } | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-surface border-r border-border">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center transition-all group-hover:glow-primary">
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-display font-bold text-[17px] text-foreground tracking-tight">SeaGeo</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground px-2 mb-1">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-all duration-100",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    )}
                  >
                    <item.icon className={cn(
                      "w-[15px] h-[15px] flex-shrink-0",
                      isActive(item.href) ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.href) && (
                      <ChevronRight className="w-3 h-3 text-primary/50" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-2 transition-colors cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary text-xs font-bold">
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate leading-tight">
              {profile?.full_name ?? profile?.email ?? "Utente"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Piano {profile?.plan ?? "free"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

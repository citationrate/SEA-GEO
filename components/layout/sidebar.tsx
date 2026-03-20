"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/lib/i18n/context";
import {
  LayoutDashboard, FolderOpen, Play, BarChart3,
  Users, Link2, Tag, GitCompare, Settings,
  Database, ChevronRight, Plus,
  PanelLeftClose, PanelLeftOpen, MessageSquareText,
} from "lucide-react";
import { useConsultation } from "@/lib/consultation-context";

const PRO_ROUTES = new Set(["/compare", "/datasets"]);

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string } | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const isPro = profile?.plan === "pro" || profile?.plan === "agency";
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation();
  const { openModal } = useConsultation();

  const NAV = [
    {
      group: t("sidebar.overview"),
      items: [
        { href: "/dashboard",   icon: LayoutDashboard, label: t("sidebar.dashboard")    },
        { href: "/projects",    icon: FolderOpen,      label: t("sidebar.projects")     },
      ],
    },
    {
      group: t("sidebar.analysis"),
      items: [
        { href: "/projects/new", icon: Play,            label: t("sidebar.newProject") },
        { href: "/results",     icon: BarChart3,       label: t("sidebar.results")    },
        { href: "/compare",     icon: GitCompare,      label: t("sidebar.compare")    },
        { href: "/datasets",    icon: Database,        label: t("sidebar.dataset")      },
      ],
    },
    {
      group: t("sidebar.intelligence"),
      items: [
        { href: "/competitors", icon: Users,           label: t("sidebar.competitors")   },
        { href: "/sources",     icon: Link2,           label: t("sidebar.sources")        },
        { href: "/topics",      icon: Tag,             label: t("sidebar.topics")        },
      ],
    },
    {
      group: t("sidebar.system"),
      items: [
        { href: "/settings",    icon: Settings,        label: t("sidebar.settings") },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "flex-shrink-0 flex flex-col border-r border-border transition-all duration-200",
        collapsed ? "w-14" : "w-56",
      )}
      style={{ background: "var(--background)" }}
    >
      {/* Logo + collapse toggle */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
              <rect width="32" height="32" rx="7" fill="#7ab89a"/>
              <text x="6" y="22" fontSize="20" fontFamily="Georgia, serif" fill="white" opacity="0.9">&ldquo;</text>
              <text x="14" y="22" fontSize="20" fontFamily="Georgia, serif" fill="#3d6b52" opacity="0.85">&ldquo;</text>
            </svg>
            <span className="font-display text-[22px] tracking-tight" style={{ fontWeight: 300, color: "#f5f5f0", letterSpacing: "-0.02em" }}>Sea<span style={{ color: "#7ab89a" }}>Geo</span></span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="#7ab89a"/>
              <text x="6" y="22" fontSize="20" fontFamily="Georgia, serif" fill="white" opacity="0.9">&ldquo;</text>
              <text x="14" y="22" fontSize="20" fontFamily="Georgia, serif" fill="#3d6b52" opacity="0.85">&ldquo;</text>
            </svg>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors",
            collapsed && "mx-auto mt-0",
          )}
          title={collapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {!collapsed && (
              <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5 select-none">
                {group}
              </p>
            )}
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
                        collapsed && "justify-center px-0",
                        locked
                          ? "text-muted-foreground/50 cursor-default"
                          : isActive(item.href)
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                      )}
                      style={isActive(item.href) && !locked ? { background: "rgba(126,184,154,0.06)" } : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className={cn(
                        "w-[15px] h-[15px] flex-shrink-0",
                        locked ? "text-muted-foreground/40" : isActive(item.href) ? "text-primary" : "text-muted-foreground"
                      )} />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.href === "/projects" && !locked && (
                            <Link
                              href="/projects/new"
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title={t("sidebar.newProject")}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          {locked && (
                            <span className="font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">PRO</span>
                          )}
                          {isActive(item.href) && !locked && item.href !== "/projects" && (
                            <ChevronRight className="w-3 h-3 text-primary/50" />
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Consultation CTA */}
      <div className="px-2 pb-2 flex-shrink-0">
        <button
          onClick={openModal}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-[2px] text-[#c4a882] border border-[#c4a882]/20 bg-[#c4a882]/5 hover:bg-[#c4a882]/10 transition-colors",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? t("sidebar.requestConsultation") : undefined}
        >
          <MessageSquareText className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-xs font-semibold">{t("sidebar.requestConsultation")}</span>}
        </button>
      </div>

      {/* Profile → links to settings */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] hover:bg-surface-2 transition-colors",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? (profile?.full_name ?? profile?.email ?? t("sidebar.user")) : undefined}
        >
          <div className="w-6 h-6 rounded-[2px] flex items-center justify-center flex-shrink-0 text-primary font-mono text-xs" style={{ background: "var(--primary-glow)" }}>
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "U").toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-tight font-sans">
                {profile?.full_name ?? profile?.email ?? t("sidebar.user")}
              </p>
              <p className="font-mono text-[0.75rem] text-muted-foreground uppercase tracking-wide">
                {t("sidebar.plan")} {profile?.plan === "free" || !profile?.plan ? t("sidebar.planBase") : profile.plan === "pro" ? "Pro" : profile.plan === "agency" ? "Agency" : profile.plan}
              </p>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}

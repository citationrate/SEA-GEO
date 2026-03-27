"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/lib/i18n/context";
import {
  LayoutDashboard, FolderOpen, Play, BarChart3,
  Users, Link2, Tag, GitCompare, Settings,
  Database, ChevronRight, Plus,
  PanelLeftClose, PanelLeftOpen, MessageSquareText,
  ExternalLink, X, Newspaper, CreditCard,
} from "lucide-react";
import { useConsultation } from "@/lib/consultation-context";
import { useMobileNav } from "./mobile-nav-context";
import { useHasUnreadNews } from "@/components/ai-news-panel";

const PRO_ROUTES = new Set(["/compare", "/datasets"]);

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string } | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const isPro = profile?.plan === "pro" || profile?.plan === "agency";
  const isDemo = !profile?.plan || profile.plan === "demo" || profile.plan === "free";
  const isBase = profile?.plan === "base";
  const [collapsed, setCollapsed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { t } = useTranslation();
  const { openModal } = useConsultation();
  const { isOpen: mobileOpen, close: closeMobile } = useMobileNav();
  const hasUnread = useHasUnreadNews();

  // Close mobile nav on route change
  useEffect(() => { closeMobile(); }, [pathname, closeMobile]);

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
        { href: "/piano",       icon: CreditCard,      label: `Piano · ${isDemo ? "Free" : isBase ? "Base" : isPro ? "Pro" : (profile?.plan ?? "Free")}` },
        { href: "/notizie",     icon: Newspaper,       label: t("sidebar.aiNews") },
        { href: "/settings",    icon: Settings,        label: t("sidebar.settings") },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  /** Sidebar inner content — shared between desktop aside and mobile drawer */
  const sidebarContent = (
    <>
      {/* Logo + collapse/close toggle */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
        {(!collapsed || mobileOpen) && (
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={closeMobile}>
            <Image src="/logo.jpg" alt="AVI" width={28} height={28} className="flex-shrink-0 rounded-md" />
            <span className="font-display text-[22px] tracking-tight" style={{ fontWeight: 300, color: "#f5f5f0", letterSpacing: "-0.02em" }}>A<span style={{ color: "#7ab89a" }}>VI</span></span>
          </Link>
        )}
        {collapsed && !mobileOpen && (
          <Link href="/dashboard" className="mx-auto">
            <Image src="/logo.jpg" alt="AVI" width={28} height={28} className="rounded-md" />
          </Link>
        )}
        {/* Desktop: collapse toggle / Mobile: close button */}
        <button
          onClick={() => mobileOpen ? closeMobile() : setCollapsed(!collapsed)}
          className={cn(
            "w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors",
            collapsed && !mobileOpen && "mx-auto mt-0",
          )}
          title={mobileOpen ? "Chiudi" : collapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {(!collapsed || mobileOpen) && (
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
                      onClick={closeMobile}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2.5 md:py-1.5 rounded-[2px] text-sm font-sans transition-all duration-100",
                        collapsed && !mobileOpen && "justify-center px-0",
                        locked
                          ? "text-muted-foreground/50 cursor-default"
                          : isActive(item.href)
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                      )}
                      style={isActive(item.href) && !locked ? { background: "rgba(126,184,154,0.06)" } : undefined}
                      title={collapsed && !mobileOpen ? item.label : undefined}
                    >
                      <span className="relative flex-shrink-0">
                        <item.icon className={cn(
                          "w-[15px] h-[15px]",
                          locked ? "text-muted-foreground/40" : isActive(item.href) ? "text-primary" : "text-muted-foreground"
                        )} />
                        {item.href === "/notizie" && hasUnread && collapsed && !mobileOpen && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                        )}
                      </span>
                      {(!collapsed || mobileOpen) && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.href === "/notizie" && hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                          )}
                          {item.href === "/projects" && !locked && (
                            <Link
                              href="/projects/new"
                              onClick={(e) => { e.stopPropagation(); closeMobile(); }}
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

      {/* Demo upgrade banner */}
      {isDemo && (!collapsed || mobileOpen) && !bannerDismissed && (
        <div className="mx-2 mb-2 flex-shrink-0 rounded-[2px] px-3 py-2.5 relative" style={{ background: "linear-gradient(135deg, #C0C0C0, #E8E8E8)" }}>
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-sm hover:bg-black/10 transition-colors"
            style={{ color: "#555" }}
          >
            <X className="w-3 h-3" />
          </button>
          <p className="text-[11px] font-medium leading-snug pr-4" style={{ color: "#333" }}>
            {t("sidebar.demoBanner")}
          </p>
          <a
            href="/settings"
            onClick={closeMobile}
            className="inline-block mt-1.5 text-[11px] font-bold hover:opacity-80 transition-opacity"
            style={{ color: "#1a1a1a" }}
          >
            {t("sidebar.upgradeBase")} &rarr;
          </a>
        </div>
      )}

      {/* Consultation CTA */}
      <div className="px-2 pb-2 flex-shrink-0">
        <button
          onClick={() => { openModal(); closeMobile(); }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-[2px] text-[#c4a882] border border-[#c4a882]/20 bg-[#c4a882]/5 hover:bg-[#c4a882]/10 transition-colors",
            collapsed && !mobileOpen && "justify-center px-0",
          )}
          title={collapsed && !mobileOpen ? t("sidebar.requestConsultation") : undefined}
        >
          <MessageSquareText className="w-4 h-4 shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-xs font-semibold">{t("sidebar.requestConsultation")}</span>}
        </button>
      </div>

      {/* Switch tool */}
      <div className="px-2 pb-2 flex-shrink-0">
        <a
          href="https://suite.citationrate.com/dashboard"
          className={cn(
            "flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-ui transition-colors mt-1",
            collapsed && !mobileOpen && "justify-center px-0",
          )}
          style={{ color: "var(--c-sage)", borderRadius: "2px" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--c-sage-bg)"; e.currentTarget.style.color = "var(--c-cream)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--c-sage)"; }}
          title={collapsed && !mobileOpen ? t("sidebar.switchTool") : undefined}
        >
          <ExternalLink size={16} className="shrink-0" />
          {(!collapsed || mobileOpen) && t("sidebar.switchTool")}
        </a>
      </div>

      {/* Profile → links to settings */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <Link
          href="/settings"
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] hover:bg-surface-2 transition-colors",
            collapsed && !mobileOpen && "justify-center px-0",
          )}
          title={collapsed && !mobileOpen ? (profile?.full_name ?? profile?.email ?? t("sidebar.user")) : undefined}
        >
          <div className="w-6 h-6 rounded-[2px] flex items-center justify-center flex-shrink-0 text-primary font-mono text-xs" style={{ background: "var(--primary-glow)" }}>
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? "U").toUpperCase()}
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-tight font-sans">
                {profile?.full_name ?? profile?.email ?? t("sidebar.user")}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-[0.75rem] text-muted-foreground uppercase tracking-wide">
                  {t("sidebar.plan")} {isDemo ? "Demo" : isBase ? "" : profile?.plan === "agency" ? "Agency" : isPro ? "" : profile?.plan}
                </p>
                {isBase && (
                  <span className="font-mono text-[0.625rem] tracking-wide px-1 py-0.5 rounded-[2px]" style={{ background: "linear-gradient(135deg, #C0C0C0, #E8E8E8)", color: "#333" }}>BASE</span>
                )}
                {isPro && (
                  <span className="font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">PRO</span>
                )}
              </div>
            </div>
          )}
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className={cn(
          "hidden md:flex flex-shrink-0 flex-col border-r border-border transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
        style={{ background: "var(--background)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "var(--background)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

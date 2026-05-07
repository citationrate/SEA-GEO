"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/lib/i18n/context";
import {
  Radar,
  ListChecks,
  Plus,
  GitCompare,
  TrendingUp,
  FileDown,
  ArrowLeftRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  CreditCard,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useMobileNav } from "./mobile-nav-context";

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string; avatar_url?: string | null } | null;
}

export function BrandProfileSidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { isOpen: mobileOpen, close: closeMobile } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { closeMobile(); }, [pathname, closeMobile]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      try { window.localStorage.clear(); } catch {}
      try { window.sessionStorage.clear(); } catch {}
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  const isPro = profile?.plan === "pro";
  const isDemo = !profile?.plan || profile.plan === "demo";
  const isBase = profile?.plan === "base";
  const isEnterprise = profile?.plan === "enterprise";
  const planLabel = isDemo ? "Demo" : isBase ? "Base" : isPro ? "Pro" : isEnterprise ? "Enterprise" : profile?.plan ?? "Demo";
  const planColor = isBase ? "#60a5fa" : isPro || isEnterprise ? "#c4a882" : undefined;

  const NAV = [
    {
      group: t("brandProfileSidebar.run") || "Run",
      items: [
        { href: "/brand-profile",     icon: ListChecks, label: t("brandProfileSidebar.myRuns") || "Le mie run" },
        { href: "/brand-profile/new", icon: Plus,       label: t("brandProfileSidebar.newRun") || "Nuova run" },
      ],
    },
    {
      group: t("brandProfileSidebar.intelligence") || "Intelligence",
      items: [
        { href: "#",  icon: GitCompare,  label: t("brandProfileSidebar.compare") || "Confronto", soon: true },
        { href: "#",  icon: TrendingUp,  label: t("brandProfileSidebar.history") || "Storico",   soon: true },
        { href: "#",  icon: FileDown,    label: t("brandProfileSidebar.export") || "Export PDF", soon: true },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/brand-profile") return pathname === "/brand-profile";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
        {(!collapsed || mobileOpen) && (
          <Link href="/brand-profile" className="flex items-center gap-2 group" onClick={closeMobile}>
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Radar className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-[18px] tracking-tight" style={{ fontWeight: 400, color: "#f5f5f0", letterSpacing: "-0.01em" }}>
              Brand Profile
            </span>
          </Link>
        )}
        {collapsed && !mobileOpen && (
          <Link href="/brand-profile" className="mx-auto">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Radar className="w-4 h-4 text-primary" />
            </div>
          </Link>
        )}
        <button
          onClick={() => (mobileOpen ? closeMobile() : setCollapsed(!collapsed))}
          className={cn(
            "w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors",
            collapsed && !mobileOpen && "mx-auto mt-0",
          )}
          aria-label={mobileOpen ? "Close menu" : collapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {(!collapsed || mobileOpen) && (
              <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5 select-none">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item: any) => {
                const soon = !!item.soon;
                const active = isActive(item.href);
                return (
                  <li key={`${group}-${item.label}`}>
                    {soon ? (
                      <span
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-2.5 md:py-1.5 rounded-[2px] text-sm font-sans select-none",
                          collapsed && !mobileOpen && "justify-center px-0",
                          "text-muted-foreground/50 cursor-default",
                        )}
                        title={collapsed && !mobileOpen ? `${item.label} — ${t("brandProfileSidebar.comingSoon") || "Prossimamente"}` : undefined}
                      >
                        <item.icon className="w-[15px] h-[15px] text-muted-foreground/40 flex-shrink-0" />
                        {(!collapsed || mobileOpen) && (
                          <>
                            <span className="truncate flex-1">{item.label}</span>
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border border-border rounded-[2px] px-1 py-0.5">
                              {t("brandProfileSidebar.soon") || "Soon"}
                            </span>
                          </>
                        )}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={closeMobile}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-2.5 md:py-1.5 rounded-[2px] text-sm font-sans transition-all duration-100",
                          collapsed && !mobileOpen && "justify-center px-0",
                          active
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                        )}
                        style={active ? { background: "rgba(126,184,154,0.06)" } : undefined}
                        title={collapsed && !mobileOpen ? item.label : undefined}
                      >
                        <item.icon
                          className={cn(
                            "w-[15px] h-[15px] flex-shrink-0",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Switch back to AVI */}
        <div>
          {(!collapsed || mobileOpen) && (
            <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5 select-none">
              {t("brandProfileSidebar.tools") || "Strumenti"}
            </p>
          )}
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2.5 md:py-1.5 rounded-[2px] text-sm font-sans text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-all duration-100",
                  collapsed && !mobileOpen && "justify-center px-0",
                )}
                title={collapsed && !mobileOpen ? t("brandProfileSidebar.backToAvi") || "Torna ad AVI" : undefined}
              >
                <ArrowLeftRight className="w-[15px] h-[15px] flex-shrink-0 text-muted-foreground" />
                {(!collapsed || mobileOpen) && <span className="truncate">{t("brandProfileSidebar.backToAvi") || "Torna ad AVI"}</span>}
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Bottom: plan + logout */}
      <div className="border-t border-border p-2 space-y-1">
        <Link
          href="/piano"
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans transition-colors hover:bg-surface-2",
            collapsed && !mobileOpen && "justify-center px-0",
          )}
          style={planColor ? { color: planColor } : { color: "var(--muted-foreground)" }}
          title={collapsed && !mobileOpen ? `${t("sidebar.piano")} · ${planLabel}` : undefined}
        >
          {isDemo ? <Sparkles className="w-[15px] h-[15px] flex-shrink-0" /> : <CreditCard className="w-[15px] h-[15px] flex-shrink-0" />}
          {(!collapsed || mobileOpen) && (
            <span className="truncate text-xs">
              {t("sidebar.piano")} · <span className="font-medium uppercase">{planLabel}</span>
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50",
            collapsed && !mobileOpen && "justify-center px-0",
          )}
          title={collapsed && !mobileOpen ? t("sidebar.logout") : undefined}
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span className="truncate text-xs">{loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border flex-shrink-0 bg-ink transition-all duration-200",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={closeMobile} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-border bg-ink">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

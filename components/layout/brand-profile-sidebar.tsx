"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/lib/i18n/context";
import {
  Radar,
  ListChecks,
  Plus,
  GitCompare,
  TrendingUp,
  Newspaper,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  CreditCard,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useMobileNav } from "./mobile-nav-context";
import { ToolSwitcher } from "./tool-switcher";
import { useHasUnreadNews } from "@/components/ai-news-panel";

interface SidebarProps {
  profile: { full_name?: string | null; email?: string; plan?: string; avatar_url?: string | null } | null;
  bpRunsUsed?: number;
  bpRunsTotal?: number;
}

// Shared "active feedback" classes for buttons / Links in the sidebar so
// every tap shows an immediate visual confirmation. The `active:` prefix
// triggers on tap-down (mobile) and click-down (desktop), so the user
// gets feedback before the navigation completes.
const PRESS_FEEDBACK = "active:bg-primary/15 active:scale-[0.98] transition-transform duration-75";

export function BrandProfileSidebar({ profile, bpRunsUsed = 0, bpRunsTotal = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isOpen: mobileOpen, close: closeMobile } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const hasUnreadNews = useHasUnreadNews();

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
  const isAgency = profile?.plan === "agency";
  const isShowcasePlan = profile?.plan === "enterprise_showcase";
  const compareUnlocked = isPro || isEnterprise || isAgency || isShowcasePlan;
  const historyUnlocked = isBase || isPro || isEnterprise || isAgency || isShowcasePlan;
  const planLabel = isDemo ? "Demo" : isBase ? "Base" : isPro ? "Pro" : isEnterprise || isShowcasePlan ? "Enterprise" : profile?.plan ?? "Demo";
  const planColor = isBase ? "#60a5fa" : isPro || isEnterprise || isShowcasePlan ? "#c4a882" : undefined;

  const fullName = (profile?.full_name ?? "").trim();
  const email = profile?.email ?? "";
  const avatarInitial = (fullName || email || "U").charAt(0).toUpperCase();
  const isUnlimited = bpRunsTotal >= 999;
  const bpRemaining = Math.max(0, bpRunsTotal - bpRunsUsed);

  // Sidebar nav: Run + Intelligence + AI News (single item, no group label)
  // The "Sistema" group with Impostazioni was moved to the bottom area, under
  // the Piano link, per user feedback.
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
        compareUnlocked
          ? { href: "/brand-profile/compare", icon: GitCompare, label: t("brandProfileSidebar.compare") || "Confronto" }
          : { href: "#",  icon: GitCompare,  label: t("brandProfileSidebar.compare") || "Confronto", soon: true },
        historyUnlocked
          ? { href: "/brand-profile/history", icon: TrendingUp, label: t("brandProfileSidebar.history") || "Storico" }
          : { href: "#",  icon: TrendingUp,  label: t("brandProfileSidebar.history") || "Storico", soon: true },
        { href: "/brand-profile/notizie", icon: Newspaper, label: t("brandProfileSidebar.aiNews") || "AI News", showUnreadDot: true as const },
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
                        prefetch
                        onClick={closeMobile}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-2.5 md:py-1.5 rounded-[2px] text-sm font-sans transition-all duration-100 relative",
                          collapsed && !mobileOpen && "justify-center px-0",
                          PRESS_FEEDBACK,
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
                        {(!collapsed || mobileOpen) && <span className="truncate flex-1">{item.label}</span>}
                        {item.showUnreadDot && hasUnreadNews && (
                          <span
                            className={cn(
                              "rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]",
                              collapsed && !mobileOpen
                                ? "absolute top-1 right-1 w-1.5 h-1.5"
                                : "w-2 h-2 mr-1",
                            )}
                            aria-label="Nuove notizie"
                          />
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Tool switcher — Citability Score / AVI / Brand Profile.
            "Strumenti" group label removed per user feedback; the switcher
            now sits as a single dropdown without a header. */}
        <div>
          <ToolSwitcher current="bp" collapsed={collapsed && !mobileOpen} plan={profile?.plan} />
        </div>
      </nav>

      {/* Bottom: plan + impostazioni + logout + account card */}
      <div className="border-t border-border p-2 space-y-1">
        {/* Showcase accounts (enterprise_showcase) hide the Piano link —
            their plan is manually managed and the pricing flow is irrelevant. */}
        {!isShowcasePlan && (
          <Link
            href="/brand-profile/piano"
            prefetch
            onClick={closeMobile}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans transition-colors hover:bg-surface-2",
              collapsed && !mobileOpen && "justify-center px-0",
              PRESS_FEEDBACK,
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
        )}
        <Link
          href="/brand-profile/settings"
          prefetch
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors",
            collapsed && !mobileOpen && "justify-center px-0",
            PRESS_FEEDBACK,
          )}
          title={collapsed && !mobileOpen ? t("brandProfileSidebar.settings") || "Impostazioni" : undefined}
        >
          <Settings className="w-[15px] h-[15px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && (
            <span className="truncate text-xs">{t("brandProfileSidebar.settings") || "Impostazioni"}</span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[2px] text-sm font-sans text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50",
            collapsed && !mobileOpen && "justify-center px-0",
            PRESS_FEEDBACK,
          )}
          title={collapsed && !mobileOpen ? t("sidebar.logout") : undefined}
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span className="truncate text-xs">{loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}</span>}
        </button>

        {/* Account card — CS-style: avatar + name + plan badge + audit
            progress bar with X / N counter. Visible only when sidebar
            is expanded. Tap goes to settings. */}
        {(!collapsed || mobileOpen) && (
          <Link
            href="/brand-profile/settings"
            prefetch
            onClick={closeMobile}
            className={cn(
              "mt-1 flex items-start gap-2.5 p-2.5 rounded-[2px] border border-border hover:border-primary/40 hover:bg-surface-2 transition-colors",
              PRESS_FEEDBACK,
            )}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-sm text-primary font-semibold">{avatarInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="text-sm text-foreground truncate font-display leading-none">
                {fullName || (email ? email.split("@")[0] : "—")}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">PIANO</span>
                <span
                  className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.5 rounded-[2px] border"
                  style={{
                    color: planColor ?? "var(--muted-foreground)",
                    borderColor: planColor ? `${planColor}55` : "var(--border)",
                  }}
                >
                  {planLabel}
                </span>
              </div>
              {/* Progress bar — runs used vs runs total this month */}
              <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: isUnlimited
                      ? "100%"
                      : `${Math.min(100, (bpRunsUsed / Math.max(1, bpRunsTotal)) * 100)}%`,
                    opacity: isUnlimited ? 0.4 : 1,
                  }}
                />
              </div>
              <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {isUnlimited ? "∞" : `${bpRunsUsed} / ${bpRunsTotal}`}{" "}
                <span className="text-muted-foreground/70">
                  {t("brandProfileSidebar.runsThisMonth") || "run/mese"}
                </span>
              </div>
            </div>
          </Link>
        )}
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

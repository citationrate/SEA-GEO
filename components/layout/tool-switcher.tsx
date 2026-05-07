"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, BarChart3, Radar, ArrowLeftRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTranslation } from "@/lib/i18n/context";

export type Tool = "cs" | "avi" | "bp";

interface ToolDef {
  id: Tool;
  url: string;
  // tKey resolves through the existing i18n; falls back to fallback
  nameKey: string;
  fallback: string;
  Icon: typeof Activity;
}

// During soft launch the BP entry is filtered out for non-whitelisted users.
// The Sidebar passes `bpUnlocked` (computed from profile.email vs the
// whitelist in lib/brand-profile/plans.ts) so whitelisted accounts see the
// BP entry too. To launch publicly, just always include bp.
const TOOLS_BASE: ToolDef[] = [
  {
    id: "cs",
    url: "https://suite.citationrate.com/dashboard",
    nameKey: "toolSwitcher.cs",
    fallback: "Citability Score",
    Icon: Activity,
  },
  {
    id: "avi",
    url: "https://avi.citationrate.com/dashboard",
    nameKey: "toolSwitcher.avi",
    fallback: "AI Visibility Index",
    Icon: BarChart3,
  },
];

const BP_TOOL: ToolDef = {
  id: "bp",
  url: "https://avi.citationrate.com/brand-profile",
  nameKey: "toolSwitcher.bp",
  fallback: "Brand Profile",
  Icon: Radar,
};

export function ToolSwitcher({
  current,
  collapsed,
  bpUnlocked = false,
}: {
  current: Tool;
  collapsed?: boolean;
  bpUnlocked?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const TOOLS: ToolDef[] = bpUnlocked ? [...TOOLS_BASE, BP_TOOL] : TOOLS_BASE;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const triggerLabel = t("toolSwitcher.label") || "Cambia strumento";
  const otherTools = TOOLS.filter((tt) => tt.id !== current);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? triggerLabel : undefined}
        className={cn(
          "w-full flex items-center gap-2 rounded-[2px] transition-colors text-sm",
          collapsed ? "justify-center py-2" : "py-2 px-3 justify-between",
        )}
        style={{ color: "var(--muted-foreground)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--primary-glow, rgba(126,184,154,0.06))";
          e.currentTarget.style.color = "var(--foreground)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--muted-foreground)";
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <ArrowLeftRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">{triggerLabel}</span>}
        </span>
        {!collapsed && (
          <ChevronUp className={cn("w-3.5 h-3.5 transition-transform", open ? "rotate-0" : "rotate-180")} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full mb-1 left-0 right-0 min-w-[180px] z-50 rounded-[2px] border border-border bg-ink shadow-lg overflow-hidden"
        >
          {otherTools.map((tt) => {
            const Icon = tt.Icon;
            const label = t(tt.nameKey) || tt.fallback;
            return (
              <a
                key={tt.id}
                href={tt.url}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm transition-colors text-foreground hover:bg-surface-2"
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

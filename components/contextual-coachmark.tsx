"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

/**
 * Lightweight, anchored coachmark for AVI — surfaces a small bubble next to
 * a target element after a window of user inactivity, pointing at the next
 * action the user should take. Mirror of the suite-side
 * `src/components/ContextualCoachmark.tsx`. See that file for the broader
 * rationale; this file kept in sync intentionally to keep the UX identical
 * across the two tools.
 *
 * Dismissal is sticky via localStorage. The flag prefix is `coachmark.` so
 * a user who dismisses `coachmark.cs-...` on the suite side is independent
 * from `coachmark.avi-...` here, but the localStorage scope is per-host
 * anyway (suite.citationrate.com vs avi.citationrate.com), so there's no
 * accidental cross-talk.
 */

interface ContextualCoachmarkProps {
  id: string;
  anchorSelector: string;
  idleSeconds?: number;
  condition?: () => boolean | Promise<boolean>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  onCta?: () => void;
  position?: "top" | "bottom";
}

const STORAGE_PREFIX = "coachmark.";

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  } catch {
    /* ignore */
  }
}

export function ContextualCoachmark({
  id,
  anchorSelector,
  idleSeconds = 30,
  condition,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
  position = "bottom",
}: ContextualCoachmarkProps) {
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const dismiss = useCallback(() => {
    markDismissed(id);
    setVisible(false);
  }, [id]);

  useEffect(() => {
    cancelled.current = false;
    if (isDismissed(id)) return;

    const start = () => {
      if (cancelled.current || isDismissed(id)) return;
      const el = document.querySelector(anchorSelector);
      if (!el) return;
      setRect((el as HTMLElement).getBoundingClientRect());
      setVisible(true);
    };

    const armTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(start, idleSeconds * 1000);
    };

    const reset = () => {
      if (visible) return;
      armTimer();
    };

    (async () => {
      if (condition) {
        try {
          const allowed = await condition();
          if (!allowed || cancelled.current) return;
        } catch {
          /* fail-open */
        }
      }
      armTimer();
    })();

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      cancelled.current = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, anchorSelector, idleSeconds]);

  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const el = document.querySelector(anchorSelector);
      if (el) setRect((el as HTMLElement).getBoundingClientRect());
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [visible, anchorSelector]);

  if (!visible || !rect) return null;

  const PAD = 12;
  const BUBBLE_WIDTH = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320);
  const anchorCenterX = rect.left + rect.width / 2;
  let leftPos = anchorCenterX - BUBBLE_WIDTH / 2;
  if (typeof window !== "undefined") {
    leftPos = Math.max(PAD, Math.min(leftPos, window.innerWidth - BUBBLE_WIDTH - PAD));
  }
  const topPos = position === "bottom" ? rect.bottom + PAD : rect.top - PAD - 160;

  const handleCta = () => {
    markDismissed(id);
    if (onCta) onCta();
    if (ctaHref && typeof window !== "undefined") {
      window.location.href = ctaHref;
    }
  };

  return (
    <>
      <div
        className="fixed pointer-events-none z-[90] animate-pulse"
        style={{
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: "6px",
          boxShadow: "0 0 0 2px rgb(126 184 154), 0 0 24px rgba(126,184,154,0.45)",
        }}
      />
      <div
        role="dialog"
        aria-live="polite"
        className="fixed z-[91] rounded-[4px] border border-primary/40 bg-background shadow-2xl p-4"
        style={{
          left: leftPos,
          top: topPos,
          width: BUBBLE_WIDTH,
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <p className="font-display text-sm font-semibold text-foreground mb-1 pr-6">{title}</p>
        <p className="text-[13px] leading-relaxed text-foreground/80 mb-3">{description}</p>
        <button
          type="button"
          onClick={handleCta}
          className="w-full text-xs font-semibold uppercase tracking-wide bg-primary text-primary-foreground py-2 rounded-[2px] hover:bg-primary/90 transition-colors"
        >
          {ctaLabel} →
        </button>
      </div>
    </>
  );
}

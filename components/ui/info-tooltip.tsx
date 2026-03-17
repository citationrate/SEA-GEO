"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Info } from "lucide-react";
import { createPortal } from "react-dom";

/**
 * Lightweight info tooltip. Shows on hover/focus.
 * Uses a portal so the popup is never clipped by parent overflow.
 */
export function InfoTooltip({ text }: { text: string | undefined }) {
  if (!text) return null;
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      top: r.top - 8,
      left: r.left + r.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!show) return;
    updatePos();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [show, updatePos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none inline-flex"
        aria-label="Informazioni"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && pos && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-[9999] w-64 px-3 py-2 rounded-[2px] border border-border bg-surface shadow-lg text-xs text-foreground leading-relaxed pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
          }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 border-r border-b border-border bg-surface" />
        </div>,
        document.body,
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Loader2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function CsPromptModal({
  open,
  brand,
  pending,
  onAccept,
  onDecline,
}: {
  open: boolean;
  brand: string;
  pending: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onDecline(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onDecline]);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prev = {
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      bodyPadding: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev.bodyOverflow;
      document.body.style.position = prev.bodyPosition;
      document.body.style.top = prev.bodyTop;
      document.body.style.width = prev.bodyWidth;
      document.body.style.paddingRight = prev.bodyPadding;
      document.documentElement.style.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open || !mounted) return null;

  const fillBrand = (key: string) => t(key).replace("{brand}", brand);

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      style={{ contain: "layout paint", isolation: "isolate" }}
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onDecline(); }}
    >
      <div
        className="card w-full max-w-md flex flex-col border border-primary/40 bg-background"
        style={{ overscrollBehavior: "contain", transform: "translateZ(0)", willChange: "transform" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary shrink-0" />
            <h2 className="font-display font-semibold text-foreground text-base leading-tight">
              {fillBrand("brandProfile.csPromptModalTitle")}
            </h2>
          </div>
          <button
            onClick={onDecline}
            disabled={pending}
            className="p-1 hover:bg-muted rounded-[2px] transition-colors disabled:opacity-40"
            aria-label="close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm text-foreground/85 leading-relaxed">
            {fillBrand("brandProfile.csPromptModalBody")}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onDecline}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {t("brandProfile.csPromptModalDecline")}
          </button>
          <button
            onClick={onAccept}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            {t("brandProfile.csPromptModalAccept")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

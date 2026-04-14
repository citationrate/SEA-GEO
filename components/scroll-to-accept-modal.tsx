"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n/context";

interface ScrollToAcceptModalProps {
  open: boolean;
  onAccept: () => void;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function ScrollToAcceptModal({
  open,
  onAccept,
  onClose,
  title,
  children,
}: ScrollToAcceptModalProps) {
  const { t } = useTranslation();
  const [canAccept, setCanAccept] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setCanAccept(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCanAccept(false);
      return;
    }
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;
    const observer = new IntersectionObserver(observerCallback, {
      root: scrollContainer,
      threshold: 1.0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, observerCallback]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          width: "min(640px, 90vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 className="font-display" style={{ color: "var(--foreground)", fontSize: 18, margin: 0 }}>
            {title || t("modal.saleTermsTitle")}
          </h3>
          <span
            className="font-mono"
            style={{ color: "var(--muted-foreground)", fontSize: 10, textTransform: "uppercase" }}
          >
            {t("modal.scrollToAccept")}
          </span>
        </div>

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: "20px 24px", maxHeight: 400 }}
        >
          <div style={{ color: "var(--foreground)", fontSize: 13, lineHeight: 1.8 }}>
            {children}
          </div>
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--muted-foreground)",
              border: "1px solid var(--border)",
              padding: "10px 20px",
              fontSize: 13,
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            {t("modal.close")}
          </button>
          <button
            onClick={onAccept}
            disabled={!canAccept}
            style={{
              background: canAccept ? "var(--primary)" : "var(--border)",
              color: canAccept ? "#fff" : "var(--muted-foreground)",
              border: "none",
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              cursor: canAccept ? "pointer" : "not-allowed",
              borderRadius: 2,
              transition: "all 0.2s",
            }}
          >
            {t("modal.accept")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  route?: string;
  selector?: string;
  tooltipPosition: "center" | "right" | "bottom-right" | "bottom-left" | "top-right";
}

const LS_KEY = "seageo_onboarding_done";

function getSteps(firstProjectId: string | null): OnboardingStep[] {
  const pid = firstProjectId ?? "__none__";
  return [
    {
      title: "Benvenuto in SeaGeo 👋",
      description:
        "SeaGeo misura quanto il tuo brand è visibile\nnelle risposte dei principali motori AI.\n\nIn pochi minuti scoprirai dove appari, con che sentiment\ne chi sono i tuoi competitor secondo l'AI.",
      tooltipPosition: "center",
    },
    {
      title: "Crea il tuo primo progetto",
      description:
        "Ogni progetto corrisponde a un brand da analizzare.\nInserisci il brand, il sito web e il settore\nper iniziare a misurare la tua AI visibility.",
      route: "/projects",
      selector: '[data-tour="new-project-btn"]',
      tooltipPosition: "bottom-right",
    },
    {
      title: "Aggiungi le query",
      description:
        "Le query sono le domande che SeaGeo pone ai motori AI.\nAggiungi domande che un utente reale potrebbe fare\nriguardo al tuo settore.\n\nUsa il generatore AI per partire velocemente.",
      route: `/projects/${pid}`,
      selector: '[data-tour="add-query-btn"]',
      tooltipPosition: "right",
    },
    {
      title: "Lancia la tua prima analisi",
      description:
        "Clicca qui per avviare l'analisi.\nSeaGeo interrogherà i modelli AI selezionati\ne calcolerà il tuo AVI in pochi minuti.",
      route: `/projects/${pid}`,
      selector: '[data-tour="launch-analysis-btn"]',
      tooltipPosition: "bottom-left",
    },
    {
      title: "Il tuo AI Visibility Index",
      description:
        "L'AVI è il tuo punteggio da 0 a 100.\nMisura quanto sei presente, rilevante\ne ben percepito nelle risposte AI.\n\nMonitoralo nel tempo per vedere i progressi.",
      route: "/dashboard",
      selector: '[data-tour="avi-ring"]',
      tooltipPosition: "right",
    },
    {
      title: "Confronto Competitivo",
      description:
        "Scopri come te la cavi negli scontri diretti\ncontro i tuoi competitor.\n\nWin Rate, First Mention Rate e CompScore\nti dicono chi preferiscono le AI.",
      route: "/compare",
      selector: '[data-tour="new-comparison-btn"]',
      tooltipPosition: "bottom-right",
    },
  ];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [firstProjectId, setFirstProjectId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const rafRef = useRef<number>(0);
  const steps = getSteps(firstProjectId);
  const step = steps[current];

  // Fetch first project ID
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null)
      .then((data) => {
        // The projects route returns array or single object
        if (Array.isArray(data) && data.length > 0) {
          setFirstProjectId(data[0].id);
        }
      });
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LS_KEY) !== "true") {
      setActive(true);
    }
  }, []);

  // Listen for manual restart
  useEffect(() => {
    const handler = () => {
      setCurrent(0);
      setRect(null);
      setActive(true);
    };
    window.addEventListener("restart-onboarding-tour", handler);
    return () => window.removeEventListener("restart-onboarding-tour", handler);
  }, []);

  // Track element position via rAF
  const updateRect = useCallback(() => {
    if (!active || !step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 6;
      setRect({
        x: r.x - pad,
        y: r.y - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
    } else {
      setRect(null);
    }
    rafRef.current = requestAnimationFrame(updateRect);
  }, [active, step?.selector]);

  useEffect(() => {
    if (!active) return;
    rafRef.current = requestAnimationFrame(updateRect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, updateRect]);

  // Navigate to step route when step changes
  useEffect(() => {
    if (!active || !step?.route) return;

    // Replace __none__ project IDs — skip step if no project
    if (step.route.includes("__none__")) return;

    if (pathname !== step.route) {
      setNavigating(true);
      setRect(null);
      router.push(step.route);
    }
  }, [active, current, step?.route, pathname, router]);

  // After route navigation, wait for elements to render
  useEffect(() => {
    if (!navigating) return;
    const timeout = setTimeout(() => {
      setNavigating(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [navigating, pathname]);

  const complete = useCallback(async () => {
    setActive(false);
    localStorage.setItem(LS_KEY, "true");
    cancelAnimationFrame(rafRef.current);
    // Also persist server-side
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_completed: true }),
    }).catch(() => {});
  }, []);

  function handleNext() {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
      setRect(null);
    } else {
      complete();
    }
  }

  function handleBack() {
    if (current > 0) {
      setCurrent(current - 1);
      setRect(null);
    } else {
      complete();
    }
  }

  if (!active) return null;

  // Viewport size for SVG
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  // Tooltip position calculation
  const tooltipW = 360;
  const tooltipH = 220;
  let tooltipX = 0;
  let tooltipY = 0;

  if (step.tooltipPosition === "center" || !rect) {
    tooltipX = vw / 2 - tooltipW / 2;
    tooltipY = vh / 2 - tooltipH / 2;
  } else if (step.tooltipPosition === "right") {
    tooltipX = rect.x + rect.width + 16;
    tooltipY = rect.y + rect.height / 2 - tooltipH / 2;
  } else if (step.tooltipPosition === "bottom-right") {
    tooltipX = rect.x;
    tooltipY = rect.y + rect.height + 12;
  } else if (step.tooltipPosition === "bottom-left") {
    tooltipX = rect.x + rect.width - tooltipW;
    tooltipY = rect.y + rect.height + 12;
  } else if (step.tooltipPosition === "top-right") {
    tooltipX = rect.x + rect.width + 16;
    tooltipY = rect.y;
  }

  // Clamp to viewport
  tooltipX = Math.max(12, Math.min(vw - tooltipW - 12, tooltipX));
  tooltipY = Math.max(12, Math.min(vh - tooltipH - 12, tooltipY));

  return (
    <>
      {/* SVG overlay with spotlight mask */}
      <svg
        className="fixed inset-0"
        style={{ zIndex: 100, pointerEvents: "none" }}
        width={vw}
        height={vh}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {rect && (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx="4"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.75)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Clickthrough passthrough for highlighted element */}
      {rect && (
        <div
          className="fixed"
          style={{
            zIndex: 105,
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Click blocker for non-highlighted areas */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 101, pointerEvents: "auto" }}
        onClick={(e) => {
          // Allow clicks on the highlighted element
          if (rect) {
            const cx = e.clientX;
            const cy = e.clientY;
            if (
              cx >= rect.x &&
              cx <= rect.x + rect.width &&
              cy >= rect.y &&
              cy <= rect.y + rect.height
            ) {
              return;
            }
          }
          e.stopPropagation();
          e.preventDefault();
        }}
      />

      {/* Tooltip */}
      {!navigating && (
        <div
          className="fixed animate-fade-in"
          style={{
            zIndex: 110,
            left: tooltipX,
            top: tooltipY,
            width: tooltipW,
            pointerEvents: "auto",
          }}
        >
          <div
            className="rounded-lg p-5 space-y-3 shadow-2xl"
            style={{
              background: "#111416",
              border: "1px solid rgba(126,184,154,0.2)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-bold text-base text-foreground leading-snug">
                {step.title}
              </h3>
              <button
                onClick={complete}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <p
              className="text-sm text-muted-foreground leading-relaxed"
              style={{ whiteSpace: "pre-line" }}
            >
              {step.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === current ? 20 : 6,
                      backgroundColor:
                        i === current ? "#7eb89a" : "rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                >
                  {current === 0 ? "Salta" : "Indietro"}
                </button>
                <button
                  onClick={handleNext}
                  className="text-xs font-semibold text-[#111416] px-3.5 py-1.5 rounded-[2px] transition-colors"
                  style={{ backgroundColor: "#7eb89a" }}
                >
                  {current === steps.length - 1 ? "Inizia!" : "Avanti"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
  pro: boolean;
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
      pro: false,
    },
    {
      title: "Dashboard — Il tuo AVI",
      description:
        "L'AI Visibility Index è il tuo punteggio da 0 a 100.\nMisura presenza, rilevanza e sentiment del tuo brand\nnelle risposte AI.\n\nMonitoralo nel tempo per vedere i progressi.",
      route: "/dashboard",
      selector: '[data-tour="avi-ring"]',
      tooltipPosition: "right",
      pro: false,
    },
    {
      title: "Top Competitor",
      description:
        "I brand che le AI citano più spesso\ncome alternativa al tuo.\n\nSono scoperti automaticamente durante l'analisi.",
      route: "/dashboard",
      selector: '[data-tour="top-competitors"]',
      tooltipPosition: "right",
      pro: false,
    },
    {
      title: "Progetti",
      description:
        "Ogni progetto corrisponde a un brand da analizzare.\nPuoi avere più brand attivi contemporaneamente\ne monitorarli separatamente.",
      route: "/projects",
      selector: '[data-tour="new-project-btn"]',
      tooltipPosition: "bottom-right",
      pro: false,
    },
    {
      title: "Query",
      description:
        "Le query sono le domande che SeaGeo pone ai motori AI.\nAggiungi domande che un utente reale potrebbe fare\nriguardo al tuo settore.",
      route: `/projects/${pid}`,
      selector: '[data-tour="add-query-btn"]',
      tooltipPosition: "right",
      pro: false,
    },
    {
      title: "Genera Query con AI ✨",
      description:
        "Genera automaticamente query strutturate\nin famiglie Generali, Verticali e Personas.\n\nIl sistema usa template deterministici\nper garantire coerenza e comparabilità.",
      route: `/projects/${pid}`,
      selector: '[data-tour="generate-queries-btn"]',
      tooltipPosition: "bottom-right",
      pro: true,
    },
    {
      title: "Lancia Analisi",
      description:
        "Avvia l'analisi: SeaGeo interroga i modelli AI\ne calcola il tuo AVI in pochi minuti.\n\nScegli il numero di run:\n1 = veloce | 2 = bilanciato | 3 = preciso",
      route: `/projects/${pid}`,
      selector: '[data-tour="launch-analysis-btn"]',
      tooltipPosition: "bottom-left",
      pro: false,
    },
    {
      title: "Competitor",
      description:
        "Tutti i brand scoperti dalle AI come alternative al tuo.\nClassificati per tipo: Diretto, Indiretto, Canale, Aggregatore.\n\nPuoi analizzare i contesti con AI\nper capire perché vengono citati insieme.",
      route: "/competitors",
      selector: '[data-tour="competitors-tab"]',
      tooltipPosition: "right",
      pro: false,
    },
    {
      title: "Confronto Competitivo ⚔️",
      description:
        "Scontri diretti Brand A vs Brand B su driver specifici.\n\nWin Rate: chi viene raccomandato più spesso\nFirst Mention Rate: chi viene citato per primo\nCompScore: KPI sintetico 0-100",
      route: "/compare",
      selector: '[data-tour="new-comparison-btn"]',
      tooltipPosition: "bottom-right",
      pro: true,
    },
    {
      title: "Dataset",
      description:
        "Accedi alle risposte raw di ogni singolo prompt.\nFiltra per modello, run, query, famiglia e persona.\n\nEspandi ogni riga per leggere la risposta completa\ne le fonti consultate dall'AI.",
      route: "/datasets",
      selector: '[data-tour="dataset-table"]',
      tooltipPosition: "right",
      pro: true,
    },
    {
      title: "Generatore Query Avanzato",
      description:
        "Descrivi il tuo brand con use case, criteri e must-have.\nIl sistema genera automaticamente query strutturate\ncon Layer A/B/C e famiglie TOFU/MOFU.\n\nPreview del costo prima di salvare.",
      route: `/projects/${pid}/queries/generate`,
      selector: '[data-tour="query-wizard-step1"]',
      tooltipPosition: "center",
      pro: true,
    },
    {
      title: "Sei pronto! 🚀",
      description:
        "Hai visto tutte le sezioni di SeaGeo.\n\nInizia creando il tuo primo progetto\ne lancia la tua prima analisi.\n\nI risultati arrivano in pochi minuti.",
      tooltipPosition: "center",
      pro: false,
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

  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

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
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-foreground leading-snug">
                  {step.title}
                </h3>
                {step.pro && (
                  <span
                    className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5"
                    style={{
                      background: "rgba(126,184,154,0.15)",
                      border: "1px solid rgba(126,184,154,0.4)",
                      color: "#7eb89a",
                      borderRadius: "4px",
                    }}
                  >
                    ✦ Pro
                  </span>
                )}
              </div>
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
              <div className="flex items-center gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === current ? 16 : 5,
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

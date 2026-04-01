"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

interface OnboardingStep {
  title: string;
  description: string;
  route?: string;
  selector?: string;
  tooltipPosition: "center" | "right" | "bottom-right" | "bottom-left" | "top-right";
  pro: boolean;
}

const LS_KEY = "seageo_onboarding_done";

function getSteps(firstProjectId: string | null, t: (key: string) => string): OnboardingStep[] {
  const pid = firstProjectId ?? "__none__";
  return [
    // 0 — Welcome (center, no highlight)
    {
      title: t("onboarding.welcome") + " 👋",
      description: t("onboarding.welcomeDesc"),
      tooltipPosition: "center",
      pro: false,
    },
    // 1 — Sidebar navigation
    {
      title: t("onboarding.navigation"),
      description: t("onboarding.navigationDesc"),
      route: "/dashboard",
      selector: '[data-tour="sidebar-nav"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 2 — Dashboard: AVI Ring
    {
      title: t("onboarding.dashboardAvi"),
      description: t("onboarding.dashboardAviDesc"),
      route: "/dashboard",
      selector: '[data-tour="avi-ring"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 3 — Dashboard: AVI Trend
    {
      title: t("onboarding.aviOverTime"),
      description: t("onboarding.aviOverTimeDesc"),
      route: "/dashboard",
      selector: '[data-tour="avi-trend"]',
      tooltipPosition: "top-right",
      pro: false,
    },
    // 4 — Dashboard: Top Competitors
    {
      title: t("onboarding.topCompetitors"),
      description: t("onboarding.topCompetitorsDesc"),
      route: "/dashboard",
      selector: '[data-tour="top-competitors"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 5 — Dashboard: Recent Runs
    {
      title: t("onboarding.recentAnalyses"),
      description: t("onboarding.recentAnalysesDesc"),
      route: "/dashboard",
      selector: '[data-tour="recent-runs"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 6 — Projects
    {
      title: t("onboarding.projectsTitle"),
      description: t("onboarding.projectsDesc"),
      route: "/projects",
      selector: '[data-tour="new-project-btn"]',
      tooltipPosition: "bottom-right",
      pro: false,
    },
    // 8 — Project detail: queries
    {
      title: t("onboarding.projectQueries"),
      description: t("onboarding.projectQueriesDesc"),
      route: `/projects/${pid}`,
      selector: '[data-tour="project-queries"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 9 — Project detail: add query
    {
      title: t("onboarding.addQuery"),
      description: t("onboarding.addQueryDesc"),
      route: `/projects/${pid}`,
      selector: '[data-tour="add-query-btn"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 10 — Project detail: generate queries (available to all plans)
    {
      title: t("onboarding.generatePrompt") + " ✨",
      description: t("onboarding.generatePromptDesc"),
      route: `/projects/${pid}`,
      selector: '[data-tour="generate-queries-btn"]',
      tooltipPosition: "bottom-right",
      pro: false,
    },
    // 11 — Project detail: launch analysis
    {
      title: t("onboarding.launchAnalysis"),
      description: t("onboarding.launchAnalysisDesc"),
      route: `/projects/${pid}`,
      selector: '[data-tour="launch-analysis-btn"]',
      tooltipPosition: "bottom-left",
      pro: false,
    },
    // 12 — Project detail: run results
    {
      title: t("onboarding.analysisResults"),
      description: t("onboarding.analysisResultsDesc"),
      route: `/projects/${pid}`,
      selector: '[data-tour="run-results"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 13 — Competitors page
    {
      title: t("onboarding.competitorsTitle"),
      description: t("onboarding.competitorsDesc"),
      route: "/competitors",
      selector: '[data-tour="competitors-tab"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 14 — Competitors: analyze contexts
    {
      title: t("onboarding.analyzeContexts"),
      description: t("onboarding.analyzeContextsDesc"),
      route: "/competitors",
      selector: '[data-tour="analyze-contexts-btn"]',
      tooltipPosition: "bottom-left",
      pro: false,
    },
    // 15 — Results page
    {
      title: t("onboarding.resultsTitle"),
      description: t("onboarding.resultsDesc"),
      route: "/results",
      selector: '[data-tour="results-page"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 16 — Compare page
    {
      title: t("onboarding.compareTitle") + " ⚔️",
      description: t("onboarding.compareDesc"),
      route: "/compare",
      selector: '[data-tour="confronto-page"]',
      tooltipPosition: "right",
      pro: true,
    },
    // 16 — Dataset page: table
    {
      title: t("onboarding.datasetTitle"),
      description: t("onboarding.datasetDesc"),
      route: "/datasets",
      selector: '[data-tour="dataset-table"]',
      tooltipPosition: "right",
      pro: true,
    },
    // 17 — Dataset page: filters
    {
      title: t("onboarding.datasetFilters"),
      description: t("onboarding.datasetFiltersDesc"),
      route: "/datasets",
      selector: '[data-tour="dataset-filters"]',
      tooltipPosition: "bottom-right",
      pro: true,
    },
    // — Sources page
    {
      title: t("onboarding.sourcesTitle"),
      description: t("onboarding.sourcesDesc"),
      route: "/sources",
      selector: '[data-tour="sources-page"]',
      tooltipPosition: "right",
      pro: false,
    },
    // — Topics page
    {
      title: t("onboarding.topicsTitle"),
      description: t("onboarding.topicsDesc"),
      route: "/topics",
      selector: '[data-tour="topics-page"]',
      tooltipPosition: "right",
      pro: false,
    },
    // — Query wizard (available to all plans)
    {
      title: t("onboarding.queryWizard"),
      description: t("onboarding.queryWizardDesc"),
      route: `/projects/${pid}/queries/generate`,
      selector: '[data-tour="query-wizard-step1"]',
      tooltipPosition: "center",
      pro: false,
    },
    // — Piano page
    {
      title: t("onboarding.pianoTitle"),
      description: t("onboarding.pianoDesc"),
      route: "/piano",
      selector: '[data-tour="sidebar-plan"]',
      tooltipPosition: "right",
      pro: false,
    },
    // — Settings: account
    {
      title: t("onboarding.settingsProfile"),
      description: t("onboarding.settingsProfileDesc"),
      route: "/settings",
      selector: '[data-tour="settings-account"]',
      tooltipPosition: "right",
      pro: false,
    },
    // 20 — Finish
    {
      title: t("onboarding.ready") + " 🚀",
      description: t("onboarding.readyDesc"),
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

export function OnboardingTour({ onboardingCompleted = false }: { onboardingCompleted?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const searchParamsRef = useRef<URLSearchParams | null>(null);

  const [active, setActive] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [firstProjectId, setFirstProjectId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [viewportSize, setViewportSize] = useState({ vw: 1920, vh: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    searchParamsRef.current = new URLSearchParams(window.location.search);
    setViewportSize({ vw: window.innerWidth, vh: window.innerHeight });
    const onResize = () => setViewportSize({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const rafRef = useRef<number>(0);
  const steps = getSteps(firstProjectId, t);
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

  // Tour activates ONLY on first-ever login (onboarding not completed in DB or localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lsDone = localStorage.getItem(LS_KEY);
    const isWelcome = searchParamsRef.current?.get("welcome") === "1";

    // Clean the ?welcome=1 param from URL immediately (prevent re-triggers on re-render)
    if (isWelcome) {
      window.history.replaceState({}, "", pathname);
      searchParamsRef.current = new URLSearchParams(); // prevent re-reading stale params
    }

    // Show tour ONLY if not completed in EITHER DB or localStorage
    if (!onboardingCompleted && !lsDone && pathname === "/dashboard") {
      setActive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Skip steps that reference projects when no project exists
  const shouldSkipStep = useCallback(
    (stepIndex: number) => {
      const s = getSteps(firstProjectId, t)[stepIndex];
      return s?.route?.includes("__none__") ?? false;
    },
    [firstProjectId, t]
  );

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

    // Persist to DB BEFORE navigating — await to ensure it completes
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      // Fallback: try the profile PATCH endpoint
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboarding_completed: true }),
        });
      } catch { /* localStorage will prevent re-show on this device */ }
    }

    // First-time user (no projects) → redirect to new project creation
    // Returning user (restarted tour) → stay on dashboard
    if (!firstProjectId) {
      toast.success(t("onboarding.letsStart"));
      router.push("/projects/new");
    } else {
      router.push("/dashboard");
    }
  }, [router, firstProjectId, t]);

  function handleNext() {
    let next = current + 1;
    while (next < steps.length && shouldSkipStep(next)) {
      next++;
    }
    if (next < steps.length) {
      setCurrent(next);
      setRect(null);
    } else {
      complete();
    }
  }

  function handleBack() {
    let prev = current - 1;
    while (prev >= 0 && shouldSkipStep(prev)) {
      prev--;
    }
    if (prev >= 0) {
      setCurrent(prev);
      setRect(null);
    } else {
      complete();
    }
  }

  if (!active || !mounted) return null;

  const vw = viewportSize.vw;
  const vh = viewportSize.vh;

  const tooltipW = 410;

  // Count visible (non-skipped) steps for progress dots
  const visibleSteps = steps.map((_, i) => !shouldSkipStep(i));
  const visibleIndices = visibleSteps.reduce<number[]>((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
  const currentVisibleIndex = visibleIndices.indexOf(current);

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

      {/* Tooltip — fixed bottom-right, never moves */}
      {!navigating && (
        <div
          className="fixed animate-fade-in sm:!left-auto"
          style={{
            zIndex: 110,
            bottom: 16,
            right: 16,
            left: 16,
            width: "auto",
            maxWidth: 440,
            pointerEvents: "auto",
          }}
        >
          <div
            className="rounded-lg p-4 sm:p-5 space-y-3 shadow-2xl max-w-[440px]"
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
                    className="shrink-0 text-[13px] font-semibold px-1.5 py-0.5"
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
              style={{ whiteSpace: "pre-line", overflowWrap: "break-word" }}
            >
              {step.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              {/* Progress dots */}
              <div className="flex items-center gap-1">
                {visibleIndices.map((vi, dotIdx) => (
                  <div
                    key={vi}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: dotIdx === currentVisibleIndex ? 16 : 5,
                      backgroundColor:
                        dotIdx === currentVisibleIndex ? "#7eb89a" : "rgba(255,255,255,0.15)",
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
                  {current === 0 ? t("common.skip") : t("common.back")}
                </button>
                <button
                  onClick={handleNext}
                  className="text-xs font-semibold text-[#111416] px-3.5 py-1.5 rounded-[2px] transition-colors"
                  style={{ backgroundColor: "#7eb89a" }}
                >
                  {current === steps.length - 1 || (current === visibleIndices[visibleIndices.length - 1]) ? t("common.start") + "!" : t("common.next")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

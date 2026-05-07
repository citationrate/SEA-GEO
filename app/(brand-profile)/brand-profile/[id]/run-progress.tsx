"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";

const PILLARS = ["recognition", "clarity", "authority", "relevance", "sentiment"] as const;
type Pillar = (typeof PILLARS)[number];

// Pentagon vertices (math angle, then converted to SVG y-down) at radius=78.
// Starting at the top, going clockwise. Order MUST match PILLARS so the
// active pillar pulse syncs with the active status message.
const RADIUS = 78;
const VERTICES: Record<Pillar, { x: number; y: number; angle: number }> = (() => {
  const out: Record<Pillar, { x: number; y: number; angle: number }> = {} as any;
  PILLARS.forEach((p, i) => {
    const angleDeg = -90 + i * 72;
    const rad = (angleDeg * Math.PI) / 180;
    out[p] = {
      x: RADIUS * Math.cos(rad),
      y: RADIUS * Math.sin(rad),
      angle: angleDeg,
    };
  });
  return out;
})();

// SVG path for the pentagon connecting the 5 vertices.
const PENTAGON_PATH = (() => {
  const pts = PILLARS.map((p) => `${VERTICES[p].x.toFixed(2)},${VERTICES[p].y.toFixed(2)}`);
  return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} L ${pts[4]} Z`;
})();

const PILLAR_CYCLE_MS = 1400; // ~7s for a full sweep across the 5 pillars

export function RunInProgressAnimation({
  brand,
  status,
  completed,
  total,
  locale,
}: {
  brand: string;
  status: "pending" | "running";
  completed: number;
  total: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), PILLAR_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const activeIdx = tick % PILLARS.length;
  const activePillar = PILLARS[activeIdx];
  const progressPct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const pillarLabel = (p: Pillar) => t(`brandProfile.pillar${p.charAt(0).toUpperCase()}${p.slice(1)}`);
  const statusMsg = t(`brandProfile.runProgressStep_${activePillar}`).replace("{brand}", brand);

  return (
    <div className="card p-8 border-primary/30 bg-primary/[0.03]">
      <div className="flex flex-col items-center gap-5">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {status === "pending" ? t("brandProfile.runProgressQueued") : t("brandProfile.runProgressTitle")}
        </div>

        {/* Radar SVG — viewBox extended horizontally so the leftmost
            ("Sentiment") and rightmost ("Notorietà") labels don't get
            clipped at end-anchor when text extends past the radar radius.
            Mobile: width caps at 100% of parent so very small phones
            (<320px) don't trigger horizontal scrolling. */}
        <div className="relative w-full max-w-[320px] aspect-[320/260]">
          <svg viewBox="-160 -130 320 260" className="w-full h-full" aria-hidden>
            <defs>
              <radialGradient id="bp-sweep-gradient" cx="0" cy="0" r="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
                <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Concentric grid rings */}
            {[0.33, 0.66, 1].map((scale) => (
              <circle
                key={scale}
                cx="0"
                cy="0"
                r={RADIUS * scale}
                fill="none"
                stroke="var(--line)"
                strokeOpacity="0.35"
                strokeWidth="0.5"
              />
            ))}

            {/* Spokes from center to each vertex */}
            {PILLARS.map((p) => (
              <line
                key={`spoke-${p}`}
                x1="0"
                y1="0"
                x2={VERTICES[p].x}
                y2={VERTICES[p].y}
                stroke="var(--line)"
                strokeOpacity="0.25"
                strokeWidth="0.5"
              />
            ))}

            {/* Pentagon outline (faded) */}
            <path d={PENTAGON_PATH} fill="none" stroke="var(--line)" strokeOpacity="0.4" strokeWidth="0.75" />

            {/* Sweeping cone */}
            <g className="bp-sweep-rotor" style={{ transformOrigin: "0 0" }}>
              <path
                d={`M 0 0 L ${RADIUS + 10} -8 A ${RADIUS + 10} ${RADIUS + 10} 0 0 1 ${RADIUS + 10} 8 Z`}
                fill="url(#bp-sweep-gradient)"
              />
              <line x1="0" y1="0" x2={RADIUS + 10} y2="0" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.8" />
            </g>

            {/* Vertex dots — the active one pulses */}
            {PILLARS.map((p) => {
              const isActive = p === activePillar;
              return (
                <g key={`dot-${p}`}>
                  {isActive && (
                    <circle
                      cx={VERTICES[p].x}
                      cy={VERTICES[p].y}
                      r="10"
                      fill="var(--primary)"
                      fillOpacity="0.18"
                      className="bp-pulse-ring"
                    />
                  )}
                  <circle
                    cx={VERTICES[p].x}
                    cy={VERTICES[p].y}
                    r={isActive ? 4.5 : 2.5}
                    fill="var(--primary)"
                    fillOpacity={isActive ? 1 : 0.4}
                    style={{ transition: "all 300ms ease-out" }}
                  />
                </g>
              );
            })}

            {/* Center dot pulsing */}
            <circle cx="0" cy="0" r="3" fill="var(--primary)" className="bp-center-pulse" />

            {/* Pillar labels */}
            {PILLARS.map((p) => {
              const v = VERTICES[p];
              const labelX = v.x * 1.28;
              const labelY = v.y * 1.28;
              const isActive = p === activePillar;
              const anchor = labelX < -10 ? "end" : labelX > 10 ? "start" : "middle";
              return (
                <text
                  key={`label-${p}`}
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="10"
                  fontFamily="var(--font-syne, inherit)"
                  fill={isActive ? "var(--primary)" : "var(--muted-foreground)"}
                  fillOpacity={isActive ? 1 : 0.55}
                  style={{ transition: "fill-opacity 300ms ease-out" }}
                >
                  {pillarLabel(p)}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Status message — rotates with the active pillar */}
        <div className="min-h-[2.5rem] text-center">
          <p key={activeIdx} className="bp-fade-in text-sm text-foreground leading-relaxed">
            {statusMsg}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("brandProfile.runProgressHint")}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            <span>{t("brandProfile.runProgressPromptsLabel")}</span>
            <span className="tabular-nums">
              {completed} / {total > 0 ? total : "…"}
              {total > 0 && <span className="ml-2 text-foreground">{progressPct}%</span>}
            </span>
          </div>
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700 ease-out"
              style={{ width: total > 0 ? `${progressPct}%` : "0%" }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.bp-sweep-rotor) {
          animation: bp-sweep ${PILLAR_CYCLE_MS * PILLARS.length}ms linear infinite;
          transform-origin: 0 0;
        }
        @keyframes bp-sweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        :global(.bp-pulse-ring) {
          animation: bp-pulse 1400ms ease-out infinite;
          transform-origin: center;
        }
        @keyframes bp-pulse {
          0%   { transform: scale(0.3); opacity: 0.6; }
          70%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        :global(.bp-center-pulse) {
          animation: bp-center-pulse 1800ms ease-in-out infinite;
        }
        @keyframes bp-center-pulse {
          0%, 100% { fill-opacity: 0.6; r: 3; }
          50%      { fill-opacity: 1;   r: 4; }
        }
        :global(.bp-fade-in) {
          animation: bp-fade 400ms ease-out;
        }
        @keyframes bp-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

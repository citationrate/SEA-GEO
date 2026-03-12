"use client";

import { InfoTooltip } from "@/components/ui/info-tooltip";

interface AVIComponent {
  label: string;
  color: string;
  desc: string;
  value: number | null;
}

export function AVIBars({ items }: { items: AVIComponent[] }) {
  return (
    <div className="card p-5 space-y-3">
      {items.map((c) => (
        <div key={c.label}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <InfoTooltip text={c.desc} />
            </div>
            <span className="font-display font-bold text-base text-foreground tabular-nums">{c.value ?? "--"}</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, c.value ?? 0)}%`, backgroundColor: c.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

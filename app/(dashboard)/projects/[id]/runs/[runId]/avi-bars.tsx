"use client";

import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

interface AVIComponent {
  labelKey?: string;
  label?: string;
  color: string;
  descKey?: string;
  desc?: string;
  value: number | null;
}

export function AVIBars({
  items,
  stabilityScore,
  showSingleRunNote,
}: {
  items: AVIComponent[];
  stabilityScore?: number | null;
  showSingleRunNote?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="card p-5 space-y-4">
      {items.map((c) => {
        const label = c.labelKey ? t(c.labelKey) : c.label ?? "";
        const desc = c.descKey ? t(c.descKey) : c.desc ?? "";
        return (
          <div key={label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <InfoTooltip text={desc} />
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
        );
      })}

      {/* Stability badge — inline at the bottom */}
      {stabilityScore != null && (
        <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[12px] font-medium ${
            stabilityScore > 80
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : stabilityScore >= 50
              ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}>
            {stabilityScore > 80
              ? t("dashboard.highReliability")
              : stabilityScore >= 50
              ? t("dashboard.mediumReliability")
              : t("dashboard.lowReliability")} ({Math.round(stabilityScore)})
          </span>
          <InfoTooltip text={t("dashboard.reliabilityTooltip")} />
        </div>
      )}
      {showSingleRunNote && stabilityScore != null && (
        <p className="text-xs text-muted-foreground text-right">{t("dashboard.singleRunNote")}</p>
      )}
    </div>
  );
}

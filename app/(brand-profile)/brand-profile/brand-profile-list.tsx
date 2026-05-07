"use client";

import { Radar, Plus, Globe, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

interface RunItem {
  id: string;
  brand_name: string;
  sector: string;
  country: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_prompts: number;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { keyLabel: string; cls: string }> = {
    completed: { keyLabel: "brandProfile.statusCompleted", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    running: { keyLabel: "brandProfile.statusRunning", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    pending: { keyLabel: "brandProfile.statusPending", cls: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
    failed: { keyLabel: "brandProfile.statusFailed", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  };
  const cfg = map[status] ?? { keyLabel: "", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-[2px] text-[11px] border ${cfg.cls}`}>
      {cfg.keyLabel ? t(cfg.keyLabel) : status}
    </span>
  );
}

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(`${locale}-${locale.toUpperCase()}`, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BrandProfileList({
  runs,
  plan,
  runsUsed,
  runLimit,
}: {
  runs: RunItem[];
  plan: string;
  runsUsed: number;
  runLimit: number;
}) {
  const { t, locale } = useTranslation();
  const remaining = Math.max(0, runLimit - runsUsed);
  const canRun = remaining > 0;
  const isUnlimited = runLimit >= 999;
  const isFreeOrDemo = plan === "demo" || plan === "free";

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            {t("brandProfile.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("brandProfile.tagline")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{t("brandProfile.runsRemaining")}</div>
            <div className="text-sm font-display font-semibold text-foreground">
              {isUnlimited ? t("brandProfile.unlimited") : `${remaining} / ${runLimit}`}
            </div>
          </div>
          {canRun ? (
            <Link
              href="/brand-profile/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("brandProfile.newRun")}
            </Link>
          ) : (
            <Link
              href="/piano"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] border border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
            >
              {isFreeOrDemo ? t("brandProfile.upgradeUnlock") : t("brandProfile.quotaExhausted")}
            </Link>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <Radar className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground max-w-md">
            {t("brandProfile.emptyState")}
          </p>
          {canRun && (
            <Link
              href="/brand-profile/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("brandProfile.emptyCta")}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {runs.map((r) => (
            <Link
              key={r.id}
              href={`/brand-profile/${r.id}`}
              className="card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-display font-semibold text-foreground line-clamp-1">{r.brand_name}</h3>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{r.sector}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {r.country}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(r.started_at, locale)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

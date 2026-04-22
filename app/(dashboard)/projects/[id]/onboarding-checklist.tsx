"use client";

import { useState } from "react";
import { MessageSquare, Users, Play, Check, Sparkles, BarChart3, TrendingUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { QuickStartModal } from "@/components/quick-start-modal";

export function ProjectOnboardingChecklist({
  projectId,
  queryCount,
  segmentCount,
  runsCount = 0,
}: {
  projectId: string;
  queryCount: number;
  segmentCount: number;
  runsCount?: number;
}) {
  const { t } = useTranslation();
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  const step1Done = queryCount >= 2;
  const step2Done = segmentCount > 0;
  const step3Ready = step1Done;
  const step4Done = runsCount >= 1;
  const step5Done = runsCount >= 3;

  const totalMilestones = 5;
  const completedMilestones = [step1Done, step2Done, step4Done, step5Done].filter(Boolean).length
    + (step3Ready ? 1 : 0);
  const progress = Math.round((completedMilestones / totalMilestones) * 100);

  const allComplete = completedMilestones === totalMilestones;

  function handleLaunch() {
    window.dispatchEvent(new CustomEvent("open-analysis-modal"));
  }

  const step1Cta = step1Done
    ? t("projectDetail.setupstep1DoneCta")
    : queryCount >= 1
      ? t("projectDetail.setupstep1PartialCta")
      : t("projectDetail.setupstep1Cta");

  const step2Cta = step2Done ? t("projectDetail.setupstep2DoneCta") : t("projectDetail.setupstep2Cta");

  // Compact mode: all milestones done → single-line confirmation
  if (allComplete) {
    return (
      <div className="card px-5 py-3 flex items-center justify-between border border-sage/40 bg-sage/5">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-sage" />
          <p className="text-sm font-medium text-foreground">{t("projectDetail.setupCompleteTitle")}</p>
          <span className="text-xs text-muted-foreground">· {t("projectDetail.setupCompleteDesc")}</span>
        </div>
        <span className="text-xs text-sage font-mono font-bold">{totalMilestones}/{totalMilestones}</span>
      </div>
    );
  }

  // Quick Start: shown only before the first analysis, as the fastest path
  const showQuickStart = runsCount === 0;

  return (
    <div className="card p-5 space-y-4 border border-primary/40 bg-primary/5">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("projectDetail.setuptitle")}</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{completedMilestones}/{totalMilestones} · {progress}%</span>
      </div>

      <p className="text-xs text-muted-foreground">{t("projectDetail.setupsubtitle")}</p>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {showQuickStart && !step1Done && (
        <button
          type="button"
          onClick={() => setQuickStartOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-[2px] border border-primary bg-primary/10 p-3 hover:bg-primary/15 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("projectDetail.quickStartTitle")}</p>
              <p className="text-[11px] text-muted-foreground truncate">{t("projectDetail.quickStartDesc")}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-primary shrink-0">{t("projectDetail.quickStartCta")} →</span>
        </button>
      )}

      <QuickStartModal
        open={quickStartOpen}
        projectId={projectId}
        onClose={() => setQuickStartOpen(false)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Queries */}
        <div className={`rounded-[2px] border p-4 space-y-2.5 ${
          step1Done ? "border-sage/40 bg-sage/5" : "border-border bg-muted/10"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step1Done ? "bg-sage text-background" : "bg-muted text-muted-foreground"
            }`}>
              {step1Done ? <Check className="w-3.5 h-3.5" /> : "1"}
            </div>
            <p className="text-sm font-semibold text-foreground">{t("projectDetail.setupstep1Title")}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{t("projectDetail.setupstep1Desc")}</p>
          <a
            href={`/projects/${projectId}/queries`}
            className="w-full flex items-center justify-center gap-1.5 bg-surface border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-[2px] hover:border-primary/30 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {step1Cta}
          </a>
        </div>

        {/* Step 2: Audience (optional) */}
        <div className={`rounded-[2px] border p-4 space-y-2.5 ${
          step2Done ? "border-sage/40 bg-sage/5" : "border-border bg-muted/10"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step2Done ? "bg-sage text-background" : "bg-muted text-muted-foreground"
            }`}>
              {step2Done ? <Check className="w-3.5 h-3.5" /> : "2"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t("projectDetail.setupstep2Title")}</p>
              <p className="text-[11px] text-muted-foreground">{t("projectDetail.setupoptional")}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{t("projectDetail.setupstep2Desc")}</p>
          <a
            href={`/projects/${projectId}/segments`}
            className="w-full flex items-center justify-center gap-1.5 bg-surface border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-[2px] hover:border-primary/30 transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            {step2Cta}
          </a>
        </div>

        {/* Step 3: Launch */}
        <div className={`rounded-[2px] border p-4 space-y-2.5 ${
          step3Ready ? "border-primary/40 bg-primary/10" : "border-border bg-muted/10 opacity-70"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step3Ready ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              3
            </div>
            <p className="text-sm font-semibold text-foreground">{t("projectDetail.setupstep3Title")}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {step3Ready ? t("projectDetail.setupstep3Desc") : t("projectDetail.setupstep3Locked")}
          </p>
          <button
            onClick={handleLaunch}
            disabled={!step3Ready}
            className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground font-semibold text-xs px-3 py-2 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            {t("projectDetail.setupstep3Cta")}
          </button>
        </div>
      </div>

      {/* Post-launch milestones: first analysis + trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className={`flex items-center gap-2.5 rounded-[2px] border p-3 ${
          step4Done ? "border-sage/40 bg-sage/5" : "border-border bg-muted/10"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            step4Done ? "bg-sage text-background" : "bg-muted text-muted-foreground"
          }`}>
            {step4Done ? <Check className="w-3.5 h-3.5" /> : "4"}
          </div>
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{t("projectDetail.setupstep4Title")}</p>
            <p className="text-[11px] text-muted-foreground truncate">{t("projectDetail.setupstep4Desc")}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2.5 rounded-[2px] border p-3 ${
          step5Done ? "border-sage/40 bg-sage/5" : "border-border bg-muted/10"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            step5Done ? "bg-sage text-background" : "bg-muted text-muted-foreground"
          }`}>
            {step5Done ? <Check className="w-3.5 h-3.5" /> : "5"}
          </div>
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{t("projectDetail.setupstep5Title")}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {runsCount > 0 && runsCount < 3
                ? t("projectDetail.setupstep5DescPartial").replace("{n}", String(runsCount))
                : t("projectDetail.setupstep5Desc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

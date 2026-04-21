"use client";

import { MessageSquare, Users, Play, Check, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function ProjectOnboardingChecklist({
  projectId,
  queryCount,
  segmentCount,
}: {
  projectId: string;
  queryCount: number;
  segmentCount: number;
}) {
  const { t } = useTranslation();

  const step1Done = queryCount >= 2;
  const step2Done = segmentCount > 0;
  const step3Ready = step1Done;

  const completedSteps = (step1Done ? 1 : 0) + (step2Done ? 1 : 0);
  const progress = Math.round((completedSteps / 2) * 100);

  function handleLaunch() {
    window.dispatchEvent(new CustomEvent("open-analysis-modal"));
  }

  const step1Cta = step1Done
    ? t("projectDetail.setupstep1DoneCta")
    : queryCount >= 1
      ? t("projectDetail.setupstep1PartialCta")
      : t("projectDetail.setupstep1Cta");

  const step2Cta = step2Done ? t("projectDetail.setupstep2DoneCta") : t("projectDetail.setupstep2Cta");

  return (
    <div className="card p-5 space-y-4 border border-primary/40 bg-primary/5">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("projectDetail.setuptitle")}</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{completedSteps}/2 · {progress}%</span>
      </div>

      <p className="text-xs text-muted-foreground">{t("projectDetail.setupsubtitle")}</p>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

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
    </div>
  );
}

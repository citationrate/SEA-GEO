"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { ContextualCoachmark } from "@/components/contextual-coachmark";

export function ProjectsHeader({ hasProjects }: { hasProjects?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("projects.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("projects.subtitle")}</p>
      </div>
      <a
        href="/projects/new"
        data-tour="new-project-btn"
        data-coachmark="avi-new-project-btn"
        className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px]"
      >
        <Plus className="w-4 h-4" />
        {t("projects.newProject")}
      </a>
      {hasProjects === false && (
        <ContextualCoachmark
          id="avi-new-project-btn"
          anchorSelector='[data-coachmark="avi-new-project-btn"]'
          idleSeconds={20}
          title={t("coach.aviDashboardTitle")}
          description={t("coach.aviDashboardDesc")}
          ctaLabel={t("coach.aviDashboardCta")}
          ctaHref="/projects/new"
          position="bottom"
        />
      )}
    </div>
  );
}

"use client";

import { Settings, Cpu, Trash2, PlayCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { RestartTourButton } from "./restart-tour-button";

export function SettingsHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Settings className="w-6 h-6 text-accent" />
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>
    </div>
  );
}

export function AIModelsSection({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-5 h-5 text-primary" />
        <h2 className="font-display font-semibold text-foreground">{t("settings.allAIModels")}</h2>
      </div>
      {children}
    </div>
  );
}

export function TourSection() {
  const { t } = useTranslation();
  return (
    <div data-tour="settings-tour" className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <PlayCircle className="w-5 h-5 text-primary" />
        <h2 className="font-display font-semibold text-foreground">{t("settings.guidedTour")}</h2>
      </div>
      <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("settings.reviewTour")}</p>
        <RestartTourButton />
      </div>
    </div>
  );
}

export function DeletedProjectsSection() {
  const { t } = useTranslation();
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="w-5 h-5 text-destructive" />
        <h2 className="font-display font-semibold text-foreground">{t("settings.deletedProjects")}</h2>
      </div>
      <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("settings.restoreDeleted")}</p>
        <a
          href="/settings/deleted-projects"
          className="px-4 py-2 bg-muted/30 border border-[rgba(255,255,255,0.1)] text-foreground rounded-[2px] text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {t("common.manage")}
        </a>
      </div>
    </div>
  );
}

"use client";

import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function ResultsHeader() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-foreground">{t("results.title")}</h1>
      <p className="text-sm text-muted-foreground mt-0.5">{t("results.subtitle")}</p>
    </div>
  );
}

export function ResultsEmpty() {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col items-center justify-center py-24 text-center">
      <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{t("results.noAnalysis")}</p>
      <a href="/projects" className="text-sm text-primary hover:text-primary/70 transition-colors mt-2">
        {t("common.goToProjects")} &rarr;
      </a>
    </div>
  );
}

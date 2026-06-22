"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

const SUITE_URL = "https://suite.citationrate.com/hub";

// UX unificata: i progetti si creano/gestiscono nella suite, non in AVI.
// Il bottone "Nuovo Progetto" è sostituito da un link alla suite.
export function ProjectsHeader({ hasProjects: _hasProjects }: { hasProjects?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("projects.title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("projects.subtitle")}</p>
      </div>
      <a
        href={SUITE_URL}
        className="flex items-center gap-2 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-card/40 transition-colors"
      >
        Crea nella Suite
        <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}

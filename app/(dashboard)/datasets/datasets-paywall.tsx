"use client";

import { Database, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function DatasetsPaywall() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">{t("datasets.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("datasets.subtitle")}</p>
        </div>
      </div>
      <div className="card p-16 text-center border border-dashed border-[#c4a882]/30 space-y-4">
        <Lock className="w-12 h-12 text-[#c4a882]/40 mx-auto" />
        <h2 className="font-display font-semibold text-xl text-foreground">{t("compare.proFeature")}</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("datasets.proDescription")}</p>
        <p className="text-muted-foreground text-sm mt-1">{t("compare.proOnly")} — €159{t("piano.perMonth")} {t("piano.plusVat")}</p>
        <a href="/piano#piani" className="inline-flex items-center gap-2 bg-[#c4a882] text-background font-semibold text-sm px-6 py-2.5 rounded-[2px] hover:bg-[#c4a882]/85 transition-colors mt-2">
          Scopri il piano Pro &rarr;
        </a>
      </div>
    </div>
  );
}

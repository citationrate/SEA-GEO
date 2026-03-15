"use client";

import { useTranslation } from "@/lib/i18n/context";

export function TranslatedStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    pending: t("results.pending"),
    running: t("results.running"),
    completed: t("results.completed"),
    failed: t("results.failed"),
    cancelled: t("results.cancelled"),
  };
  return <>{map[status] ?? status}</>;
}

export function TranslatedLabel({ tkey }: { tkey: string }) {
  const { t } = useTranslation();
  return <>{t(tkey)}</>;
}

export function TranslatedReliability({ score }: { score: number }) {
  const { t } = useTranslation();
  const label = score > 80
    ? t("dashboard.highReliability")
    : score >= 50
    ? t("dashboard.mediumReliability")
    : t("dashboard.lowReliability");
  return <>{label} ({Math.round(score)})</>;
}

export function TranslatedReliabilityTooltip() {
  const { t } = useTranslation();
  return <>{t("dashboard.reliabilityTooltip")}</>;
}

export function TranslatedSingleRunNote() {
  const { t } = useTranslation();
  return <p className="text-xs text-muted-foreground mt-1.5">{t("dashboard.singleRunNote")}</p>;
}

"use client";

import { AVIRing } from "@/components/dashboard/index";
import { useTranslation } from "@/lib/i18n/context";

export function RunAVIRing(props: { score: number | null; trend: number | null; components?: { label?: string; labelKey?: string; v: number | null }[]; noBrandMentions?: boolean }) {
  const { t } = useTranslation();
  const translatedComponents = props.components?.map(c => ({
    label: c.labelKey ? t(c.labelKey) : c.label ?? "",
    v: c.v,
  }));
  return <AVIRing {...props} components={translatedComponents} />;
}

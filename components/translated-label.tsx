"use client";

import { useTranslation } from "@/lib/i18n/context";

export function T({ k }: { k: string }) {
  const { t } = useTranslation();
  return <>{t(k)}</>;
}

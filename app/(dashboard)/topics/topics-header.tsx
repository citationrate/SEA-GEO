"use client";

import { Tag } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function TopicsHeader({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Tag className="w-6 h-6 text-accent" />
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">{t("topics.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {count} {t("topics.relevantTopics")}
        </p>
      </div>
    </div>
  );
}

export function TopicsEmpty() {
  const { t } = useTranslation();
  return (
    <div className="card p-12 text-center">
      <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">{t("topics.noTopicFound")}</p>
    </div>
  );
}

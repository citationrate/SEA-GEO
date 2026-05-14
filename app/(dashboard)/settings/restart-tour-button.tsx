"use client";

import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/context";

/**
 * "Rivedi tutorial" — sostituisce il vecchio onboarding-tour (overlay
 * multi-step) con il reset delle dismissal dei contextual coachmark.
 * Dopo il click, i coachmark "avi-*" tornano a comparire dopo idle
 * sulle pagine relative.
 */
export function RestartTourButton() {
  const router = useRouter();
  const { t } = useTranslation();

  function handleClick() {
    try {
      // Cancella tutte le dismissal "coachmark.avi-*" e la chiave legacy.
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("coachmark.") || key === "seageo_onboarding_done")) {
          keysToClear.push(key);
        }
      }
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch {}
    toast.success(t("settings.tourRestarted"));
    router.push("/dashboard");
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium hover:bg-primary/80 transition-colors"
    >
      <PlayCircle className="w-4 h-4" />
      {t("settings.startTour")}
    </button>
  );
}

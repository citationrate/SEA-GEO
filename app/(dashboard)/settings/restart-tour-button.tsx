"use client";

import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function RestartTourButton() {
  const router = useRouter();
  const { t } = useTranslation();

  function handleClick() {
    localStorage.removeItem("seageo_onboarding_done");
    router.push("/dashboard");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("restart-onboarding-tour"));
    }, 100);
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

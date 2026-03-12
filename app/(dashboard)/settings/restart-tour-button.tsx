"use client";

import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";

export function RestartTourButton() {
  const router = useRouter();

  function handleClick() {
    localStorage.removeItem("seageo_onboarding_done");
    router.push("/dashboard");
    // Small delay so the route change triggers before the tour checks localStorage
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
      Avvia Tour
    </button>
  );
}

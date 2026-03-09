"use client";

import { Play } from "lucide-react";

export function OpenAnalysisButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("open-analysis-modal"))}
      className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors"
    >
      <Play className="w-4 h-4" />
      Nuova Analisi
    </button>
  );
}

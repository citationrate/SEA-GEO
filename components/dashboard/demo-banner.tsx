"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "avi_demo_banner_dismissed";

export function DemoBanner({ plan }: { plan: string }) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const isDemo = !plan || plan === "demo";
  if (!isDemo || dismissed) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-[3px] border mb-6"
      style={{ background: "linear-gradient(135deg, rgba(196,168,130,0.08), rgba(196,168,130,0.03))", borderColor: "rgba(196,168,130,0.2)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Sparkles className="w-4 h-4 text-[#c4a882] shrink-0" />
        <p className="text-sm text-foreground">
          Stai usando il piano <strong>Demo</strong> — passa a Base o Pro per sbloccare tutte le funzionalità
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/piano#piani"
          className="text-xs font-medium px-3 py-1.5 rounded-[2px] bg-[#c4a882] text-white hover:bg-[#c4a882]/80 transition-colors whitespace-nowrap"
        >
          Vedi i piani &rarr;
        </Link>
        <button
          onClick={() => { setDismissed(true); localStorage.setItem(STORAGE_KEY, "true"); }}
          className="w-6 h-6 flex items-center justify-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

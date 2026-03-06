"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const MESSAGES = [
  "Interrogando i modelli AI...",
  "Analizzando le risposte...",
  "Identificando i competitor...",
  "Calcolando il sentiment...",
  "Estraendo i topic emersi...",
  "Calcolando l'AVI score...",
];

export function AnalysisProgress({
  runId,
  completedPrompts: initialCompleted,
  totalPrompts,
}: {
  runId: string;
  completedPrompts: number;
  totalPrompts: number;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialCompleted);
  const [msgIndex, setMsgIndex] = useState(0);

  // Rotate messages every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll progress every 3s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/status?run_id=${runId}`);
        if (!res.ok) return;
        const data = await res.json();
        setCompleted(data.completed_prompts ?? completed);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          router.refresh();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [runId, router, completed]);

  const pct = totalPrompts > 0 ? Math.round((completed / totalPrompts) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative card p-8 w-full max-w-md border-primary/30 shadow-xl shadow-primary/5 space-y-6 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />

        <div>
          <h2 className="font-display font-bold text-xl text-foreground animate-pulse">
            Analisi in corso...
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Stiamo interrogando i modelli AI selezionati
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{completed}</span> / {totalPrompts} prompt completati
          </p>
        </div>

        {/* Rotating message */}
        <p className="text-sm text-primary font-medium h-5 transition-opacity duration-300">
          {MESSAGES[msgIndex]}
        </p>
      </div>
    </div>
  );
}

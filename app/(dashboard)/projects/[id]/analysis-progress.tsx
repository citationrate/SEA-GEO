"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";


export function AnalysisProgress({
  runId,
  projectId,
  completedPrompts: initialCompleted,
  totalPrompts,
}: {
  runId: string;
  projectId: string;
  completedPrompts: number;
  totalPrompts: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [completed, setCompleted] = useState(initialCompleted);
  const [msgIndex, setMsgIndex] = useState(0);

  const MESSAGES = [
    t("analysisProgress.queryingModels"),
    t("analysisProgress.analyzingResponses"),
    t("analysisProgress.identifyingCompetitors"),
    t("analysisProgress.calculatingSentiment"),
    t("analysisProgress.extractingTopics"),
    t("analysisProgress.calculatingAVI"),
  ];

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
        if (data.status === "completed") {
          clearInterval(interval);
          router.push(`/projects/${projectId}/runs/${runId}`);
        } else if (data.status === "failed") {
          clearInterval(interval);
          router.refresh();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [runId, projectId, router, completed]);

  const pct = totalPrompts > 0 ? Math.round((completed / totalPrompts) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative card p-8 w-full max-w-md border-primary/30 shadow-xl shadow-primary/5 space-y-6 text-center">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">
            {t("analysisProgress.inProgress")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("analysisProgress.queryingSelected")}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">{completed}</span> / {totalPrompts} {t("analysisProgress.promptsCompleted")}
            </p>
            <span className="text-sm text-foreground font-semibold">{pct}%</span>
          </div>
        </div>

        {/* Rotating message */}
        <p className="text-sm text-primary font-medium h-5 transition-opacity duration-300 animate-pulse">
          {MESSAGES[msgIndex]}
        </p>
      </div>
    </div>
  );
}

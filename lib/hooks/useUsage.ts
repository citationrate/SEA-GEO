"use client";

import { useState, useEffect } from "react";

interface UsageData {
  plan: null;
  planId: string;
  browsingPromptsUsed: number;
  browsingPromptsLimit: number;
  browsingPromptsRemaining: number;
  noBrowsingPromptsUsed: number;
  noBrowsingPromptsLimit: number;
  noBrowsingPromptsRemaining: number;
  comparisonsUsed: number;
  comparisonsLimit: number;
  comparisonsRemaining: number;
  extraBrowsingPrompts: number;
  extraNoBrowsingPrompts: number;
  extraComparisons: number;
  urlAnalysesUsed: number;
  urlAnalysesLimit: number;
  urlAnalysesRemaining: number;
  contextAnalysesUsed: number;
  contextAnalysesLimit: number;
  contextAnalysesRemaining: number;
  canGenerateQueries: boolean;
  canAccessDataset: boolean;
  canAccessComparisons: boolean;
  maxModelsPerProject: number;
  isDemo: boolean;
  isPro: boolean;
  loading: boolean;
  // Legacy compat
  promptsUsed: number;
  promptsLimit: number;
  promptsRemaining: number;
}

const DEFAULTS: UsageData = {
  plan: null,
  planId: "demo",
  browsingPromptsUsed: 0, browsingPromptsLimit: 0, browsingPromptsRemaining: 0,
  noBrowsingPromptsUsed: 0, noBrowsingPromptsLimit: 40, noBrowsingPromptsRemaining: 40,
  comparisonsUsed: 0, comparisonsLimit: 0, comparisonsRemaining: 0,
  extraBrowsingPrompts: 0, extraNoBrowsingPrompts: 0, extraComparisons: 0,
  urlAnalysesUsed: 0, urlAnalysesLimit: 0, urlAnalysesRemaining: 0,
  contextAnalysesUsed: 0, contextAnalysesLimit: 0, contextAnalysesRemaining: 0,
  canGenerateQueries: false, canAccessDataset: false, canAccessComparisons: false,
  maxModelsPerProject: 2,
  isDemo: true, isPro: false, loading: true,
  promptsUsed: 0, promptsLimit: 40, promptsRemaining: 40,
};

export function useUsage(): UsageData {
  const [data, setData] = useState<UsageData>(DEFAULTS);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) {
          setData((d) => ({ ...d, loading: false }));
          return;
        }
        const json = await res.json();

        const totalUsed = (json.browsingPromptsUsed ?? 0) + (json.noBrowsingPromptsUsed ?? 0);
        const totalLimit = (json.browsingPromptsLimit ?? 0) + (json.noBrowsingPromptsLimit ?? 0);

        setData({
          plan: null,
          planId: json.planId ?? "demo",
          browsingPromptsUsed: json.browsingPromptsUsed ?? 0,
          browsingPromptsLimit: json.browsingPromptsLimit ?? 0,
          browsingPromptsRemaining: json.browsingPromptsRemaining ?? 0,
          noBrowsingPromptsUsed: json.noBrowsingPromptsUsed ?? 0,
          noBrowsingPromptsLimit: json.noBrowsingPromptsLimit ?? 0,
          noBrowsingPromptsRemaining: json.noBrowsingPromptsRemaining ?? 0,
          comparisonsUsed: json.comparisonsUsed ?? 0,
          comparisonsLimit: json.comparisonsLimit ?? 0,
          comparisonsRemaining: json.comparisonsRemaining ?? 0,
          extraBrowsingPrompts: json.extraBrowsingPrompts ?? 0,
          extraNoBrowsingPrompts: json.extraNoBrowsingPrompts ?? 0,
          extraComparisons: json.extraComparisons ?? 0,
          urlAnalysesUsed: json.urlAnalysesUsed ?? 0,
          urlAnalysesLimit: json.urlAnalysesLimit ?? 0,
          urlAnalysesRemaining: json.urlAnalysesRemaining ?? 0,
          contextAnalysesUsed: json.contextAnalysesUsed ?? 0,
          contextAnalysesLimit: json.contextAnalysesLimit ?? 0,
          contextAnalysesRemaining: json.contextAnalysesRemaining ?? 0,
          canGenerateQueries: json.canGenerateQueries ?? false,
          canAccessDataset: json.canAccessDataset ?? false,
          canAccessComparisons: json.canAccessComparisons ?? false,
          maxModelsPerProject: json.maxModelsPerProject ?? 2,
          isDemo: json.isDemo ?? true,
          isPro: json.isPro ?? false,
          loading: false,
          promptsUsed: totalUsed,
          promptsLimit: totalLimit,
          promptsRemaining: Math.max(0, totalLimit - totalUsed),
        });
      } catch (err) {
        console.error("[useUsage] error:", err);
        setData((d) => ({ ...d, loading: false }));
      }
    }
    load();
  }, []);

  return data;
}

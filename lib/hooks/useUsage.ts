"use client";

import { useState, useEffect } from "react";
import { createClient, createDataClient } from "@/lib/supabase/client";

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

interface Plan {
  id: string;
  display_name?: string;
  monthly_price?: number;
  annual_price?: number;
  annual_discount?: number;
  browsing_prompts: number;
  no_browsing_prompts: number;
  max_models_per_project: number;
  max_comparisons: number;
  can_generate_queries: boolean;
  can_access_dataset: boolean;
  can_access_comparisons: boolean;
}

interface UsageData {
  plan: Plan | null;
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

const DEFAULT_PLAN: Plan = {
  id: "demo",
  display_name: "Demo Gratuita",
  browsing_prompts: 0,
  no_browsing_prompts: 40,
  max_models_per_project: 2,
  max_comparisons: 0,
  can_generate_queries: false,
  can_access_dataset: false,
  can_access_comparisons: false,
};

export function useUsage(): UsageData {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [browsingPromptsUsed, setBrowsingPromptsUsed] = useState(0);
  const [noBrowsingPromptsUsed, setNoBrowsingPromptsUsed] = useState(0);
  const [comparisonsUsed, setComparisonsUsed] = useState(0);
  const [extraBrowsingPrompts, setExtraBrowsingPrompts] = useState(0);
  const [extraNoBrowsingPrompts, setExtraNoBrowsingPrompts] = useState(0);
  const [extraComparisons, setExtraComparisons] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const authClient = createClient();
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) { setLoading(false); return; }

        const supabase = createDataClient();
        // Get profile with plan_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const planId = (profile as any)?.plan ?? "demo";
        const effectivePlanId = planId === "free" ? "demo" : planId === "agency" ? "pro" : planId;

        // Get plan details
        const { data: planData } = await (supabase.from("plans") as any)
          .select("*")
          .eq("id", effectivePlanId)
          .single();

        if (planData) {
          // Fallback for plans table rows missing new columns (migration not yet applied)
          const p = planData as any;
          const fallbacks: Record<string, { bp: number; nbp: number }> = {
            demo: { bp: 0, nbp: 40 },
            base: { bp: 30, nbp: 70 },
            pro:  { bp: 90, nbp: 210 },
          };
          const fb = fallbacks[p.id] ?? fallbacks.demo;
          const maxCompFallback = p.id === "pro" ? 10 : p.id === "base" ? 0 : 0;
          setPlan({
            ...p,
            browsing_prompts: Number(p.browsing_prompts) || fb.bp,
            no_browsing_prompts: Number(p.no_browsing_prompts) || fb.nbp,
            max_comparisons: Number(p.max_comparisons) || maxCompFallback,
          } as Plan);
        } else {
          setPlan(DEFAULT_PLAN);
        }

        // Get current month usage
        const period = getCurrentPeriod();
        const { data: usage } = await (supabase.from("usage_monthly") as any)
          .select("*")
          .eq("user_id", user.id)
          .eq("period", period)
          .maybeSingle();

        if (usage) {
          setBrowsingPromptsUsed(Number(usage.browsing_prompts_used) || 0);
          setNoBrowsingPromptsUsed(Number(usage.no_browsing_prompts_used) || 0);
          setComparisonsUsed(Number(usage.comparisons_used) || 0);
          setExtraBrowsingPrompts(Number(usage.extra_browsing_prompts) || 0);
          setExtraNoBrowsingPrompts(Number(usage.extra_no_browsing_prompts) || 0);
          setExtraComparisons(Number(usage.extra_comparisons) || 0);
        }
      } catch (err) {
        console.error("[useUsage] error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const effectivePlan = plan ?? DEFAULT_PLAN;
  const isDemo = effectivePlan.id === "demo";
  const isPro = effectivePlan.id === "pro";

  // Effective limits = plan base + extra purchased
  const effectiveBrowsingLimit = effectivePlan.browsing_prompts + extraBrowsingPrompts;
  const effectiveNoBrowsingLimit = effectivePlan.no_browsing_prompts + extraNoBrowsingPrompts;
  const effectiveComparisonsLimit = effectivePlan.max_comparisons + extraComparisons;

  // Legacy compat: total prompts = browsing + no_browsing
  const totalUsed = browsingPromptsUsed + noBrowsingPromptsUsed;
  const totalLimit = effectiveBrowsingLimit + effectiveNoBrowsingLimit;

  return {
    plan: effectivePlan,
    planId: effectivePlan.id,
    browsingPromptsUsed,
    browsingPromptsLimit: effectiveBrowsingLimit,
    browsingPromptsRemaining: Math.max(0, effectiveBrowsingLimit - browsingPromptsUsed),
    noBrowsingPromptsUsed,
    noBrowsingPromptsLimit: effectiveNoBrowsingLimit,
    noBrowsingPromptsRemaining: Math.max(0, effectiveNoBrowsingLimit - noBrowsingPromptsUsed),
    comparisonsUsed,
    comparisonsLimit: effectiveComparisonsLimit,
    comparisonsRemaining: Math.max(0, effectiveComparisonsLimit - comparisonsUsed),
    extraBrowsingPrompts,
    extraNoBrowsingPrompts,
    extraComparisons,
    canGenerateQueries: effectivePlan.can_generate_queries,
    canAccessDataset: effectivePlan.can_access_dataset,
    canAccessComparisons: effectivePlan.can_access_comparisons,
    maxModelsPerProject: effectivePlan.max_models_per_project,
    isDemo,
    isPro,
    loading,
    // Legacy compat
    promptsUsed: totalUsed,
    promptsLimit: totalLimit,
    promptsRemaining: Math.max(0, totalLimit - totalUsed),
  };
}

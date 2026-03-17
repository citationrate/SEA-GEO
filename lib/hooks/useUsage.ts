"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

interface Plan {
  id: string;
  monthly_prompts: number;
  max_models_per_project: number;
  max_comparisons: number;
  can_generate_queries: boolean;
  can_access_dataset: boolean;
  can_access_comparisons: boolean;
}

interface UsageData {
  plan: Plan | null;
  promptsUsed: number;
  promptsLimit: number;
  promptsRemaining: number;
  comparisonsUsed: number;
  comparisonsLimit: number;
  comparisonsRemaining: number;
  canGenerateQueries: boolean;
  canAccessDataset: boolean;
  canAccessComparisons: boolean;
  maxModelsPerProject: number;
  loading: boolean;
}

const DEFAULT_PLAN: Plan = {
  id: "base",
  monthly_prompts: 100,
  max_models_per_project: 3,
  max_comparisons: 0,
  can_generate_queries: false,
  can_access_dataset: false,
  can_access_comparisons: false,
};

export function useUsage(): UsageData {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [promptsUsed, setPromptsUsed] = useState(0);
  const [comparisonsUsed, setComparisonsUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Get profile with plan_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();

        const planId = (profile as any)?.plan ?? "free";
        const effectivePlanId = planId === "free" ? "base" : planId === "agency" ? "pro" : planId;

        // Get plan details
        const { data: planData } = await (supabase.from("plans") as any)
          .select("*")
          .eq("id", effectivePlanId)
          .single();

        if (planData) {
          setPlan(planData as Plan);
        } else {
          setPlan(DEFAULT_PLAN);
        }

        // Get current month usage
        const period = getCurrentPeriod();
        const { data: usage } = await (supabase.from("usage_monthly") as any)
          .select("prompts_used, comparisons_used")
          .eq("user_id", user.id)
          .eq("period", period)
          .maybeSingle();

        if (usage) {
          setPromptsUsed(Number(usage.prompts_used) || 0);
          setComparisonsUsed(Number(usage.comparisons_used) || 0);
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

  return {
    plan: effectivePlan,
    promptsUsed,
    promptsLimit: effectivePlan.monthly_prompts,
    promptsRemaining: Math.max(0, effectivePlan.monthly_prompts - promptsUsed),
    comparisonsUsed,
    comparisonsLimit: effectivePlan.max_comparisons,
    comparisonsRemaining: Math.max(0, effectivePlan.max_comparisons - comparisonsUsed),
    canGenerateQueries: effectivePlan.can_generate_queries,
    canAccessDataset: effectivePlan.can_access_dataset,
    canAccessComparisons: effectivePlan.can_access_comparisons,
    maxModelsPerProject: effectivePlan.max_models_per_project,
    loading,
  };
}

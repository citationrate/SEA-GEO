import { createServiceClient } from "./supabase/service";

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * Increment prompts_used for a user in the current month.
 * Uses upsert with ON CONFLICT to handle first-time and subsequent calls.
 */
export async function incrementPromptsUsed(userId: string, count: number): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  // Try to get existing row
  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("prompts_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ prompts_used: (Number(existing.prompts_used) || 0) + count })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, prompts_used: count, comparisons_used: 0 });
  }
}

/**
 * Increment comparisons_used for a user in the current month.
 */
export async function incrementComparisonsUsed(userId: string): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("comparisons_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ comparisons_used: (Number(existing.comparisons_used) || 0) + 1 })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, prompts_used: 0, comparisons_used: 1 });
  }
}

/**
 * Get the user's plan limits from the plans table.
 */
export async function getUserPlanLimits(userId: string) {
  const svc = createServiceClient();

  const { data: profile } = await svc.from("profiles").select("plan").eq("id", userId).single();
  const planId = (profile as any)?.plan ?? "free";
  const effectivePlanId = planId === "free" ? "base" : planId === "agency" ? "pro" : planId;

  const { data: plan } = await (svc.from("plans") as any).select("*").eq("id", effectivePlanId).single();

  const defaultPlan = {
    id: "base",
    monthly_prompts: 100,
    max_models_per_project: 3,
    max_comparisons: 0,
    can_generate_queries: false,
    can_access_dataset: false,
    can_access_comparisons: false,
  };

  return plan ?? defaultPlan;
}

/**
 * Get usage for current month.
 */
export async function getCurrentUsage(userId: string) {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data } = await (svc.from("usage_monthly") as any)
    .select("prompts_used, comparisons_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  return {
    promptsUsed: Number(data?.prompts_used) || 0,
    comparisonsUsed: Number(data?.comparisons_used) || 0,
  };
}

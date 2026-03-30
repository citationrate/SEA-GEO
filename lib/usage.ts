import { createServiceClient } from "./supabase/service";

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * Increment browsing_prompts_used for a user in the current month.
 */
export async function incrementBrowsingPromptsUsed(userId: string, count: number): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("browsing_prompts_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ browsing_prompts_used: (Number(existing.browsing_prompts_used) || 0) + count })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, browsing_prompts_used: count, no_browsing_prompts_used: 0, prompts_used: 0, comparisons_used: 0 });
  }
}

/**
 * Increment no_browsing_prompts_used for a user in the current month.
 */
export async function incrementNoBrowsingPromptsUsed(userId: string, count: number): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("no_browsing_prompts_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ no_browsing_prompts_used: (Number(existing.no_browsing_prompts_used) || 0) + count })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, browsing_prompts_used: 0, no_browsing_prompts_used: count, prompts_used: 0, comparisons_used: 0 });
  }
}

/**
 * Legacy: increment prompts_used (kept for backward compat).
 */
export async function incrementPromptsUsed(userId: string, count: number): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

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
      .insert({ user_id: userId, period, prompts_used: count, comparisons_used: 0, browsing_prompts_used: 0, no_browsing_prompts_used: 0 });
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
      .insert({ user_id: userId, period, prompts_used: 0, comparisons_used: 1, browsing_prompts_used: 0, no_browsing_prompts_used: 0 });
  }
}

/**
 * Get the user's plan limits from the plans table.
 */
export async function getUserPlanLimits(userId: string) {
  const svc = createServiceClient();

  const { data: profile } = await svc.from("profiles").select("plan").eq("id", userId).single();
  const planId = (profile as any)?.plan ?? "demo";
  const effectivePlanId = planId === "free" ? "demo" : planId === "agency" ? "pro" : planId;

  const { data: plan } = await (svc.from("plans") as any).select("*").eq("id", effectivePlanId).single();

  const defaultPlan = {
    id: "demo",
    display_name: "Demo Gratuita",
    monthly_price: 0,
    annual_price: 0,
    annual_discount: 0,
    browsing_prompts: 0,
    no_browsing_prompts: 40,
    max_models_per_project: 2,
    max_comparisons: 0,
    can_generate_queries: false,
    can_access_dataset: false,
    can_access_comparisons: false,
  };

  if (!plan) return defaultPlan;

  // Fallback for plans table rows missing new columns (migration not yet applied)
  const p = plan as any;
  const fallbacks: Record<string, { bp: number; nbp: number }> = {
    demo: { bp: 0, nbp: 40 },
    base: { bp: 30, nbp: 70 },
    pro:  { bp: 90, nbp: 210 },
  };
  const fb = fallbacks[p.id] ?? fallbacks.demo;
  return {
    ...p,
    browsing_prompts: Number(p.browsing_prompts) || fb.bp,
    no_browsing_prompts: Number(p.no_browsing_prompts) || fb.nbp,
  };
}

/**
 * Get usage for current month.
 */
export async function getCurrentUsage(userId: string) {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data } = await (svc.from("usage_monthly") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  return {
    promptsUsed: Number(data?.prompts_used) || 0,
    comparisonsUsed: Number(data?.comparisons_used) || 0,
    browsingPromptsUsed: Number(data?.browsing_prompts_used) || 0,
    noBrowsingPromptsUsed: Number(data?.no_browsing_prompts_used) || 0,
    extraBrowsingPrompts: Number(data?.extra_browsing_prompts) || 0,
    extraNoBrowsingPrompts: Number(data?.extra_no_browsing_prompts) || 0,
    extraComparisons: Number(data?.extra_comparisons) || 0,
    urlAnalysesUsed: Number(data?.url_analyses_used) || 0,
    contextAnalysesUsed: Number(data?.context_analyses_used) || 0,
  };
}

/**
 * Increment url_analyses_used for a user in the current month.
 */
export async function incrementUrlAnalysesUsed(userId: string): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("url_analyses_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ url_analyses_used: (Number(existing.url_analyses_used) || 0) + 1 })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, url_analyses_used: 1, browsing_prompts_used: 0, no_browsing_prompts_used: 0, prompts_used: 0, comparisons_used: 0 });
  }
}

/* ─── Query Wallet ─── */

export async function getWallet(userId: string) {
  const svc = createServiceClient();
  const { data } = await (svc.from("query_wallet") as any)
    .select("browsing_queries, no_browsing_queries, confronti")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    browsingQueries: Number(data?.browsing_queries) || 0,
    noBrowsingQueries: Number(data?.no_browsing_queries) || 0,
    confronti: Number(data?.confronti) || 0,
  };
}

export async function consumeWalletQueries(
  userId: string,
  browsing: number,
  noBrowsing: number,
): Promise<void> {
  const svc = createServiceClient();
  const { data: existing } = await (svc.from("query_wallet") as any)
    .select("browsing_queries, no_browsing_queries")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return;
  await (svc.from("query_wallet") as any)
    .update({
      browsing_queries: Math.max(0, (Number(existing.browsing_queries) || 0) - browsing),
      no_browsing_queries: Math.max(0, (Number(existing.no_browsing_queries) || 0) - noBrowsing),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function addToWallet(
  userId: string,
  browsingQueries: number,
  noBrowsingQueries: number,
  confronti: number,
): Promise<void> {
  const svc = createServiceClient();
  const { data: existing } = await (svc.from("query_wallet") as any)
    .select("browsing_queries, no_browsing_queries, confronti")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await (svc.from("query_wallet") as any)
      .update({
        browsing_queries: (Number(existing.browsing_queries) || 0) + browsingQueries,
        no_browsing_queries: (Number(existing.no_browsing_queries) || 0) + noBrowsingQueries,
        confronti: (Number(existing.confronti) || 0) + confronti,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await (svc.from("query_wallet") as any)
      .insert({ user_id: userId, browsing_queries: browsingQueries, no_browsing_queries: noBrowsingQueries, confronti });
  }
}

/**
 * Increment context_analyses_used for a user in the current month.
 */
export async function incrementContextAnalysesUsed(userId: string): Promise<void> {
  const svc = createServiceClient();
  const period = getCurrentPeriod();

  const { data: existing } = await (svc.from("usage_monthly") as any)
    .select("context_analyses_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    await (svc.from("usage_monthly") as any)
      .update({ context_analyses_used: (Number(existing.context_analyses_used) || 0) + 1 })
      .eq("user_id", userId)
      .eq("period", period);
  } else {
    await (svc.from("usage_monthly") as any)
      .insert({ user_id: userId, period, context_analyses_used: 1, browsing_prompts_used: 0, no_browsing_prompts_used: 0, prompts_used: 0, comparisons_used: 0 });
  }
}

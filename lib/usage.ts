import { createServiceClient } from "./supabase/service";
import { createCitationRateServiceClient } from "./supabase/citationrate-service";

/**
 * UNIFICATION (post-2026-04-07)
 *
 * Two distinct counter systems live in two places:
 *
 * 1. CYCLE COUNTERS — `user_usage` table on **CitationRate** project.
 *    - One row per user (cycle_start, cycle_end + counters).
 *    - Reset on subscription anniversary (Stripe webhook on suite.citationrate.com).
 *    - Lazy-reset fallback if a webhook is missed.
 *    - Tracks: browsing_prompts_used, no_browsing_prompts_used, prompts_used,
 *              comparisons_used, url_analyses_used, context_analyses_used,
 *              cs_audits_used.
 *    - Accessed via createCitationRateServiceClient().
 *
 * 2. PURCHASED WALLET — `query_wallet` table on **seageo1** project.
 *    - Wallet of credits purchased via Stripe (mode=payment) for AVI packages.
 *    - Never resets, never expires.
 *    - Tracks: browsing_queries, no_browsing_queries, confronti.
 *    - Accessed via createServiceClient() (seageo1).
 *    - The Stripe webhook on AVI domain writes here via addToWallet().
 *
 * `plans` table also lives on CitationRate (single source of truth).
 */
const cr = () => createCitationRateServiceClient();
const sg = () => createServiceClient();

const COUNTER_RESET = {
  cs_audits_used: 0,
  browsing_prompts_used: 0,
  no_browsing_prompts_used: 0,
  prompts_used: 0,
  comparisons_used: 0,
  url_analyses_used: 0,
  context_analyses_used: 0,
};

/**
 * Ensure a user_usage row exists and the cycle is current. Lazy-resets if expired.
 * Returns the (possibly updated) row.
 */
export async function ensureUserUsage(userId: string): Promise<any> {
  const svc = cr();

  const { data: row } = await (svc.from("user_usage") as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const insert = {
      user_id: userId,
      cycle_start: now.toISOString(),
      cycle_end: end.toISOString(),
      ...COUNTER_RESET,
    };
    const { data: created } = await (svc.from("user_usage") as any)
      .insert(insert)
      .select("*")
      .single();
    return created ?? insert;
  }

  if (row.cycle_end && new Date(row.cycle_end).getTime() < Date.now()) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { data: updated } = await (svc.from("user_usage") as any)
      .update({
        cycle_start: now.toISOString(),
        cycle_end: end.toISOString(),
        ...COUNTER_RESET,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    return updated ?? row;
  }

  return row;
}

async function incrementCycleCounter(userId: string, column: string, amount: number): Promise<void> {
  // Ensure the row exists before the atomic increment
  await ensureUserUsage(userId);
  // Atomic increment via rpc — avoids read→write race conditions.
  // Falls back to non-atomic if the DB function doesn't exist yet.
  const svc = cr();
  const { error: rpcErr } = await (svc.rpc as any)("increment_usage", {
    p_user_id: userId,
    p_column: column,
    p_amount: amount,
  });
  if (rpcErr) {
    // Fallback: non-atomic (safe enough for low-concurrency pre-launch)
    console.warn("[usage] increment_usage rpc failed, using fallback:", rpcErr.message);
    const { data: row } = await (svc.from("user_usage") as any)
      .select(column)
      .eq("user_id", userId)
      .single();
    const current = Number(row?.[column]) || 0;
    await (svc.from("user_usage") as any)
      .update({ [column]: current + amount, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
}

export async function incrementBrowsingPromptsUsed(userId: string, count: number): Promise<void> {
  await incrementCycleCounter(userId, "browsing_prompts_used", count);
}

export async function incrementNoBrowsingPromptsUsed(userId: string, count: number): Promise<void> {
  await incrementCycleCounter(userId, "no_browsing_prompts_used", count);
}

/** Legacy aggregate counter (kept for backward compat). */
export async function incrementPromptsUsed(userId: string, count: number): Promise<void> {
  await incrementCycleCounter(userId, "prompts_used", count);
}

export async function incrementComparisonsUsed(userId: string): Promise<void> {
  await incrementCycleCounter(userId, "comparisons_used", 1);
}

export async function incrementUrlAnalysesUsed(userId: string): Promise<void> {
  await incrementCycleCounter(userId, "url_analyses_used", 1);
}

export async function incrementContextAnalysesUsed(userId: string): Promise<void> {
  await incrementCycleCounter(userId, "context_analyses_used", 1);
}

/**
 * Get the user's plan limits from the unified `plans` table on CitationRate.
 * NULL values in the DB mean "unlimited" (Enterprise).
 */
export async function getUserPlanLimits(userId: string) {
  const svc = cr();

  const { data: profile } = await svc.from("profiles").select("plan").eq("id", userId).single();
  const planId = (profile as any)?.plan ?? "demo";
  const effectivePlanId =
    planId === "free" ? "demo" : planId === "agency" ? "pro" : planId;

  const { data: plan } = await (svc.from("plans") as any)
    .select("*")
    .eq("id", effectivePlanId)
    .single();

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
  return plan;
}

/**
 * Get cycle usage for current user. Triggers lazy-reset if expired.
 */
export async function getCurrentUsage(userId: string) {
  const data = await ensureUserUsage(userId);
  return {
    cycleStart: data?.cycle_start ?? null,
    cycleEnd: data?.cycle_end ?? null,
    promptsUsed: Number(data?.prompts_used) || 0,
    comparisonsUsed: Number(data?.comparisons_used) || 0,
    browsingPromptsUsed: Number(data?.browsing_prompts_used) || 0,
    noBrowsingPromptsUsed: Number(data?.no_browsing_prompts_used) || 0,
    // NOTE: extra_* on user_usage are NOT the AVI wallet; the AVI wallet
    // lives in `query_wallet` on seageo1 (see getWallet() below).
    // These columns are kept for symmetry but currently unused for AVI.
    extraBrowsingPrompts: Number(data?.extra_browsing_prompts) || 0,
    extraNoBrowsingPrompts: Number(data?.extra_no_browsing_prompts) || 0,
    extraComparisons: Number(data?.extra_comparisons) || 0,
    urlAnalysesUsed: Number(data?.url_analyses_used) || 0,
    contextAnalysesUsed: Number(data?.context_analyses_used) || 0,
    csAuditsUsed: Number(data?.cs_audits_used) || 0,
  };
}

/* ─── Query Wallet (lives on seageo1.query_wallet — UNCHANGED) ─── */

export async function getWallet(userId: string) {
  const svc = sg();
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
  const svc = sg();
  // Atomic decrement with >= guard via rpc — prevents going negative.
  const { data: ok, error: rpcErr } = await (svc.rpc as any)("consume_wallet", {
    p_user_id: userId,
    p_browsing: browsing,
    p_no_browsing: noBrowsing,
  });
  if (rpcErr) {
    // Fallback: non-atomic (for pre-migration compatibility)
    console.warn("[usage] consume_wallet rpc failed, using fallback:", rpcErr.message);
    const { data: existing } = await (svc.from("query_wallet") as any)
      .select("browsing_queries, no_browsing_queries")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) return;
    const newBrowsing = Math.max(0, (Number(existing.browsing_queries) || 0) - browsing);
    const newNoBrowsing = Math.max(0, (Number(existing.no_browsing_queries) || 0) - noBrowsing);
    await (svc.from("query_wallet") as any)
      .update({ browsing_queries: newBrowsing, no_browsing_queries: newNoBrowsing, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return;
  }
  if (ok === false) {
    throw new Error("Crediti wallet insufficienti");
  }
}

export async function consumeWalletConfronti(
  userId: string,
  count: number,
): Promise<void> {
  const svc = sg();
  const { data: existing } = await (svc.from("query_wallet") as any)
    .select("confronti")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return;
  await (svc.from("query_wallet") as any)
    .update({
      confronti: Math.max(0, (Number(existing.confronti) || 0) - count),
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
  const svc = sg();
  // Atomic upsert via rpc — prevents read→write race.
  const { error: rpcErr } = await (svc.rpc as any)("add_to_wallet", {
    p_user_id: userId,
    p_browsing: browsingQueries,
    p_no_browsing: noBrowsingQueries,
    p_confronti: confronti,
  });
  if (rpcErr) {
    // Fallback: non-atomic (for pre-migration compatibility)
    console.warn("[usage] add_to_wallet rpc failed, using fallback:", rpcErr.message);
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
}

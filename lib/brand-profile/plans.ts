export const BP_RUN_LIMITS: Record<string, number> = {
  demo: 1,
  free: 1,
  base: 3,
  pro: 10,
  agency: 10,
  enterprise: 999,
};

/**
 * Soft-launch whitelist. Brand Profile is hidden from production users until
 * the public launch — only admins (profiles.is_admin = true) and a small set
 * of internal email accounts can reach the (brand-profile) route group or
 * call POST /api/brand-profile/runs.
 *
 * To launch publicly: drop this gate from `(brand-profile)/layout.tsx` and
 * the runs API, and re-add the bp entry to ToolSwitcher TOOLS.
 */
export const BP_WHITELIST_EMAILS: ReadonlySet<string> = new Set([
  "tutorial@citationrate.com",
  "gianmariacipriano3@gmail.com",
  "monzabrianzadascoprire@gmail.com",
  "tecla.casalone@gmail.com",
  "tecla.casalone@studenti.iulm.it",
]);

export function bpAccessAllowed(opts: { email?: string | null; isAdmin?: boolean | null }): boolean {
  if (opts.isAdmin === true) return true;
  const email = (opts.email ?? "").toLowerCase().trim();
  return email !== "" && BP_WHITELIST_EMAILS.has(email);
}

/**
 * Curated model pool — the same 2 models for every plan. We picked
 * claude-haiku (Anthropic, ~$0.0005/main + $0.0016 extractor) and
 * perplexity-sonar (web-search grounded, ~$0.002/main + $0.0016 extractor):
 *
 * - Haiku gives a fast, cheap, training-data view of the brand.
 * - Sonar adds a live-web view, which is what AI users with browsing
 *   actually experience — exactly the signal Brand Profile measures.
 *
 * Per-run cost ≈ 30 prompts × ~$0.003 + 1 Sonnet insights call ≈ $0.14.
 *
 * Plans differentiate on RUN QUOTA + FEATURE GATING (compare, history,
 * time-series, PDF), not on model pool. To change the pool, edit this
 * single array — every plan inherits the change.
 */
const BP_MODEL_POOL: readonly string[] = ["claude-haiku", "perplexity-sonar"];

export const BP_MODELS_BY_PLAN: Record<string, readonly string[]> = {
  demo: BP_MODEL_POOL,
  free: BP_MODEL_POOL,
  base: BP_MODEL_POOL,
  pro: BP_MODEL_POOL,
  agency: BP_MODEL_POOL,
  enterprise: BP_MODEL_POOL,
};

export function bpRunLimit(plan: string | null | undefined): number {
  return BP_RUN_LIMITS[(plan ?? "demo").toLowerCase()] ?? 0;
}

export function bpModelsForPlan(plan: string | null | undefined): string[] {
  return [...(BP_MODELS_BY_PLAN[(plan ?? "demo").toLowerCase()] ?? BP_MODELS_BY_PLAN.demo)];
}

const BP_COMPARE_PLANS = new Set(["pro", "agency", "enterprise"]);

export function bpComparePlanAllowed(plan: string | null | undefined): boolean {
  return BP_COMPARE_PLANS.has((plan ?? "demo").toLowerCase());
}

export const BP_COMPARE_MIN_RUNS = 2;
export const BP_COMPARE_MAX_RUNS = 4;

const BP_HISTORY_PLANS = new Set(["base", "pro", "agency", "enterprise"]);

export function bpHistoryPlanAllowed(plan: string | null | undefined): boolean {
  return BP_HISTORY_PLANS.has((plan ?? "demo").toLowerCase());
}

export function bpTimeSeriesAllowed(plan: string | null | undefined): boolean {
  return (plan ?? "demo").toLowerCase() === "enterprise";
}

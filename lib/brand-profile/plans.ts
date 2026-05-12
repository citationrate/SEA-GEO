export const BP_RUN_LIMITS: Record<string, number> = {
  demo: 1,
  free: 1,
  base: 3,
  pro: 10,
  agency: 10,
  enterprise: 999,
  enterprise_showcase: 999,
};

// Brand Profile è pubblico per tutti i piani. La quota viene applicata da
// `bpRunLimit` (Demo = 1, Base = 3, Pro = 10, Enterprise = 999); l'accesso
// alla route group e agli endpoint resta gated solo dal login.
export function bpAccessAllowed(_opts: { email?: string | null; isAdmin?: boolean | null; plan?: string | null }): boolean {
  return true;
}

/**
 * Curated model pool — Setup C-light. Picked to mirror what real users
 * actually see when they ask each major AI provider about a brand:
 *
 *   - gpt-5.4-mini             → default ChatGPT free tier
 *   - claude-sonnet (4.6)      → default claude.ai
 *   - gemini-2.5-flash         → default Gemini free app
 *   - grok-4.20-non-reasoning  → xAI economic tier
 *   - perplexity-sonar         → web-grounded baseline
 *
 * 5 models × 2 prompts/pillar × 5 pillars = 50 main calls per run.
 * + 50 Haiku extractor calls + 1 Sonnet insights call.
 * Measured cost ≈ $0.30-0.40/run (vs $0.28 with the previous 2-model pool).
 *
 * Plans differentiate on RUN QUOTA + FEATURE GATING (compare, history,
 * time-series, PDF), not on model pool. To change the pool, edit this
 * single array — every plan inherits the change.
 */
const BP_MODEL_POOL: readonly string[] = [
  "gpt-5.4-mini",
  "claude-sonnet",
  "gemini-2.5-flash",
  "grok-4.20-non-reasoning",
  "perplexity-sonar",
];

export const BP_MODELS_BY_PLAN: Record<string, readonly string[]> = {
  demo: BP_MODEL_POOL,
  free: BP_MODEL_POOL,
  base: BP_MODEL_POOL,
  pro: BP_MODEL_POOL,
  agency: BP_MODEL_POOL,
  enterprise: BP_MODEL_POOL,
  enterprise_showcase: BP_MODEL_POOL,
};

export function bpRunLimit(plan: string | null | undefined): number {
  return BP_RUN_LIMITS[(plan ?? "demo").toLowerCase()] ?? 0;
}

export function bpModelsForPlan(plan: string | null | undefined): string[] {
  return [...(BP_MODELS_BY_PLAN[(plan ?? "demo").toLowerCase()] ?? BP_MODELS_BY_PLAN.demo)];
}

const BP_COMPARE_PLANS = new Set(["pro", "agency", "enterprise", "enterprise_showcase"]);

export function bpComparePlanAllowed(plan: string | null | undefined): boolean {
  return BP_COMPARE_PLANS.has((plan ?? "demo").toLowerCase());
}

export const BP_COMPARE_MIN_RUNS = 2;
export const BP_COMPARE_MAX_RUNS = 4;

const BP_HISTORY_PLANS = new Set(["base", "pro", "agency", "enterprise", "enterprise_showcase"]);

export function bpHistoryPlanAllowed(plan: string | null | undefined): boolean {
  return BP_HISTORY_PLANS.has((plan ?? "demo").toLowerCase());
}

export function bpTimeSeriesAllowed(plan: string | null | undefined): boolean {
  const p = (plan ?? "demo").toLowerCase();
  return p === "enterprise" || p === "enterprise_showcase";
}

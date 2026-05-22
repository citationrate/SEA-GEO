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
 * Curated model pool — Setup C-light (May 2026 revision: Grok removed).
 *
 * Picked to mirror what real users actually see when they ask each major
 * AI provider about a brand:
 *
 *   - gpt-5.4-mini             → default ChatGPT free tier
 *   - claude-sonnet (4.6)      → default claude.ai
 *   - gemini-2.5-flash         → default Gemini free app
 *   - perplexity-sonar         → web-grounded baseline
 *
 * 4 models × 2 prompts/pillar × 5 pillars = 40 main calls per run.
 * + 40 Haiku extractor calls + 1 Haiku insights call.
 *
 * Why Grok was removed (May 2026): Grok 4.20 cost ~$0.016/call vs
 * ~$0.005 avg of the other 4 — 44% of the total main-call budget for
 * a single provider whose Italian-audience signal overlaps strongly
 * with OpenAI/Anthropic. The cost tracker also reported `output_tokens=0`
 * for every Grok call (flat billing per `unit_count`), suggesting the
 * cost was disproportionate to the actual signal delivered.
 *
 * Plans differentiate on RUN QUOTA + FEATURE GATING (compare, history,
 * time-series, PDF), not on model pool. To change the pool, edit this
 * single array — every plan inherits the change.
 */
const BP_MODEL_POOL: readonly string[] = [
  "gpt-5.4-mini",
  "claude-sonnet",
  "gemini-2.5-flash",
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

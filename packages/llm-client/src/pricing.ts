/**
 * LLM provider pricing — single source of truth for cost computation.
 *
 * Verified 2026-05-07 against official provider pricing pages:
 *   - OpenAI:    https://developers.openai.com/api/docs/pricing
 *   - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 *   - Google:    https://ai.google.dev/pricing
 *   - xAI:       https://docs.x.ai/developers/models
 *   - Perplexity: https://docs.perplexity.ai/guides/pricing
 *
 * Prices are USD per 1,000,000 tokens unless noted.
 *
 * Bumping this table:
 *   1. Update this file
 *   2. Update PRICING_VERSION below
 *   3. Update aivx-backend/cost_tracker/pricing.py to match
 *   4. Old api_call_logs rows keep their pricing_version snapshot — no rewrite
 */

export const PRICING_VERSION = "2026-05-07";

export interface LLMPricing {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
  /** USD per 1M cached input tokens (prompt caching read) */
  cachedInput?: number;
  /** USD per 1k web search calls (when invoked as a tool) */
  webSearchPer1k?: number;
}

/**
 * LLM pricing by API model id (the ID actually sent to the provider, NOT the
 * short alias used in our model selector). Keep in sync with API_MODEL_ID
 * in prompt-runner.ts.
 *
 * For OpenAI web search:
 *   - $10/1k for reasoning models
 *   - $25/1k for non-reasoning (gpt-5.4-mini, gpt-5.5) — we assume worst case
 */
export const LLM_PRICING: Record<string, LLMPricing> = {
  // OpenAI
  "gpt-5.4-mini-2026-03-17": { input: 0.75, output: 4.50, cachedInput: 0.075, webSearchPer1k: 25 },
  "gpt-5.4-2026-03-05":      { input: 0.75, output: 4.50, cachedInput: 0.075, webSearchPer1k: 25 },
  "gpt-5.5":                 { input: 5.00, output: 30.00, cachedInput: 0.50, webSearchPer1k: 25 },
  "gpt-4o":                  { input: 2.50, output: 10.00, cachedInput: 1.25, webSearchPer1k: 25 },
  "gpt-4o-mini":             { input: 0.15, output: 0.60,  cachedInput: 0.075, webSearchPer1k: 25 },

  // Anthropic
  "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00,  cachedInput: 0.10, webSearchPer1k: 10 },
  "claude-sonnet-4-5":         { input: 3.00, output: 15.00, cachedInput: 0.30, webSearchPer1k: 10 },
  "claude-sonnet-4-6":         { input: 3.00, output: 15.00, cachedInput: 0.30, webSearchPer1k: 10 },
  "claude-opus-4-7":           { input: 5.00, output: 25.00, cachedInput: 0.50, webSearchPer1k: 10 },

  // Google (Gemini)
  // Note: gemini-2.5-flash audio input would be $1.00/M, we assume text-only here
  "gemini-2.5-flash":         { input: 0.30, output: 2.50, webSearchPer1k: 14 },
  "gemini-3.1-pro-preview":   { input: 2.00, output: 12.00, webSearchPer1k: 14 },

  // xAI
  // NOTE: xAI returns usage.cost_in_usd_ticks natively in every response —
  // the tracker uses that value directly. These entries serve only as fallback
  // if the cost field is absent (shouldn't happen on Responses API).
  "grok-4.3":                  { input: 1.25, output: 2.50,  cachedInput: 0.20, webSearchPer1k: 5 },
  "grok-4.20-non-reasoning":   { input: 0.20, output: 0.50,  cachedInput: 0.05, webSearchPer1k: 5 },
  "grok-4-1-fast":             { input: 0.20, output: 0.50,  cachedInput: 0.05, webSearchPer1k: 5 }, // legacy, EOL 2026-05-15

  // Perplexity (search included in request fee at medium tier)
  "sonar":                     { input: 1.00, output: 1.00, webSearchPer1k: 8 },
  "sonar-pro":                 { input: 3.00, output: 15.00, webSearchPer1k: 10 },
};

/**
 * Embeddings (separate dim because no output tokens / web search).
 * Currently only OpenAI text-embedding-3-small is in use (in the Python CS
 * audit), kept here for completeness if we ever add embeddings to AVI.
 */
export const EMBEDDINGS_PRICING: Record<string, { input: number }> = {
  "text-embedding-3-small": { input: 0.02 },
  "text-embedding-3-large": { input: 0.13 },
};

export interface ComputeCostArgs {
  /** API model id (NOT short alias) */
  apiModel: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  webSearchCount?: number;
}

/**
 * Compute USD cost for an LLM call from token + web search counters.
 * Used as fallback when the provider doesn't return cost natively.
 * Returns 0 if model is unknown (we never want to throw from the tracker).
 */
export function computeLLMCost(args: ComputeCostArgs): number {
  const p = LLM_PRICING[args.apiModel];
  if (!p) {
    // Unknown model — log once, return 0 (the row will still be saved with cost=0
    // and the admin UI will surface "model unknown" via meta if needed).
    return 0;
  }
  const inT = args.inputTokens ?? 0;
  const outT = args.outputTokens ?? 0;
  const cachedT = args.cachedInputTokens ?? 0;
  const webN = args.webSearchCount ?? 0;

  // Cached tokens are billed at the cached rate INSTEAD of the full input rate.
  // The Anthropic / OpenAI usage objects already split: cached_input_tokens is
  // a SUBSET of input_tokens. So billable input = inT - cachedT, plus cachedT * cachedRate.
  const nonCachedIn = Math.max(0, inT - cachedT);
  const cachedRate = p.cachedInput ?? p.input;
  const inCost = (nonCachedIn * p.input + cachedT * cachedRate) / 1_000_000;
  const outCost = (outT * p.output) / 1_000_000;
  const searchCost = p.webSearchPer1k != null ? (webN * p.webSearchPer1k) / 1000 : 0;

  return Number((inCost + outCost + searchCost).toFixed(6));
}

export function computeEmbeddingsCost(apiModel: string, inputTokens: number): number {
  const p = EMBEDDINGS_PRICING[apiModel];
  if (!p) return 0;
  return Number(((inputTokens * p.input) / 1_000_000).toFixed(6));
}

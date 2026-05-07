/**
 * Unified cost tracker for AVI / Brand Profile API calls.
 *
 * Wraps any async LLM call with `trackedAICall(args, fn)` and writes one row
 * to `api_call_logs` (Supabase CitationRate) per call, fire-and-forget.
 *
 * Design:
 *   - Never throws. If logging fails (auth, network), we console.warn and
 *     return the original response untouched.
 *   - Reads provider-native cost when present (xAI cost_in_usd_ticks).
 *     Otherwise computes from token counts via pricing.ts.
 *   - Service-role client lazily initialised on first call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { PRICING_VERSION, computeLLMCost, computeEmbeddingsCost } from "./pricing";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type Product = "avi" | "brand_profile" | "cs";
export type Status = "success" | "error" | "timeout";

export interface TrackedCallArgs {
  /** Product context — drives the `product` column */
  product: Product;
  /** What the call is doing — drives the `operation` column */
  operation: string;
  /** Provider — drives the `provider` column */
  provider:
    | "openai" | "anthropic" | "google" | "xai" | "perplexity"
    | "openai_embeddings" | "dataforseo" | "apify"
    | "google_kg" | "google_youtube";
  /** API model id (the actual id sent to the provider) — null for non-LLM */
  apiModel?: string | null;
  /** Owner of the action (project owner / audit owner) */
  userId?: string | null;
  userEmail?: string | null;
  /** Project id (AVI), audit id (CS), brand profile parent run id (BP) */
  projectId?: string | null;
  /** Snapshot of project name for the admin "CLIENTE" column */
  projectName?: string | null;
  /** Run id (avi_runs.id, brand_profile_runs.id, etc) */
  runId?: string | null;
  /** Prompt id (prompts_executed.id) */
  promptId?: string | null;
  /** Free-form: pillar, actor_id, items_returned, etc */
  meta?: Record<string, unknown>;
}

export interface ExtractedUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  webSearchCount: number;
  /** Native cost in USD if the provider returned it (xAI). undefined → compute */
  nativeCostUsd?: number;
}

// --------------------------------------------------------------------------
// Supabase client (lazy)
// --------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;

function getCRServiceClient(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.CITATIONRATE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[cost-tracker] missing CR Supabase URL/SERVICE_ROLE_KEY — tracking disabled");
    return null;
  }
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

// --------------------------------------------------------------------------
// Provider-specific usage extraction
// --------------------------------------------------------------------------

export function extractUsage(provider: TrackedCallArgs["provider"], response: any): ExtractedUsage {
  const out: ExtractedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    webSearchCount: 0,
  };
  if (!response) return out;

  try {
    switch (provider) {
      case "openai":
      case "openai_embeddings": {
        // Responses API + Chat Completions both use `usage.input_tokens` /
        // `output_tokens` in recent SDKs, with `prompt_tokens` /
        // `completion_tokens` as legacy aliases.
        const u = response.usage ?? {};
        out.inputTokens = u.input_tokens ?? u.prompt_tokens ?? 0;
        out.outputTokens = u.output_tokens ?? u.completion_tokens ?? 0;
        out.cachedInputTokens =
          u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0;
        // web_search_call output items
        const items: any[] = response.output ?? [];
        out.webSearchCount = items.filter((it) => it?.type === "web_search_call").length;
        break;
      }
      case "anthropic": {
        const u = response.usage ?? {};
        out.inputTokens = u.input_tokens ?? 0;
        out.outputTokens = u.output_tokens ?? 0;
        out.cachedInputTokens = u.cache_read_input_tokens ?? 0;
        // server_tool_use blocks named "web_search" indicate searches
        const content: any[] = response.content ?? [];
        out.webSearchCount = content.filter(
          (b) => b?.type === "server_tool_use" && b?.name === "web_search",
        ).length;
        break;
      }
      case "google": {
        // Gemini SDK wraps the model output in `.response`; accept both.
        const r = response.response ?? response;
        const md = r.usageMetadata ?? {};
        out.inputTokens = md.promptTokenCount ?? 0;
        out.outputTokens = md.candidatesTokenCount ?? 0;
        out.cachedInputTokens = md.cachedContentTokenCount ?? 0;
        // grounding metadata: presence of searchEntryPoint or webSearchQueries indicates 1 grounded query
        const candidate = r.candidates?.[0];
        const grounded = candidate?.groundingMetadata?.searchEntryPoint
          || candidate?.groundingMetadata?.webSearchQueries?.length;
        out.webSearchCount = grounded ? 1 : 0;
        break;
      }
      case "xai": {
        // xAI Responses API mirrors OpenAI shape + adds cost_in_usd_ticks
        const u = response.usage ?? {};
        out.inputTokens = u.input_tokens ?? 0;
        out.outputTokens = u.output_tokens ?? 0;
        out.cachedInputTokens = u.input_tokens_details?.cached_tokens ?? 0;
        const items: any[] = response.output ?? [];
        out.webSearchCount = items.filter((it) => it?.type === "web_search_call").length;
        // Native cost: ticks are nanodollars (1 tick = 1e-9 USD)
        if (typeof u.cost_in_usd_ticks === "number") {
          out.nativeCostUsd = u.cost_in_usd_ticks / 1_000_000_000;
        }
        break;
      }
      case "perplexity": {
        const u = response.usage ?? {};
        out.inputTokens = u.prompt_tokens ?? 0;
        out.outputTokens = u.completion_tokens ?? 0;
        out.webSearchCount = 1; // Sonar always searches
        break;
      }
    }
  } catch (e) {
    console.warn("[cost-tracker] extractUsage failed for", provider, e);
  }
  return out;
}

// --------------------------------------------------------------------------
// Insert one row (fire-and-forget)
// --------------------------------------------------------------------------

interface InsertArgs extends TrackedCallArgs {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  webSearchCount: number;
  unitCount?: number;
  costUsd: number;
  status: Status;
  errorMsg?: string | null;
  durationMs: number;
}

async function insertRow(row: InsertArgs): Promise<void> {
  const sb = getCRServiceClient();
  if (!sb) return;

  const payload = {
    user_id: row.userId ?? null,
    user_email: row.userEmail ?? null,
    product: row.product,
    project_id: row.projectId ?? null,
    project_name: row.projectName ?? null,
    provider: row.provider,
    model: row.apiModel ?? null,
    operation: row.operation,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    cached_input_tokens: row.cachedInputTokens,
    web_search_count: row.webSearchCount,
    unit_count: row.unitCount ?? 1,
    cost_usd: row.costUsd,
    pricing_version: PRICING_VERSION,
    status: row.status,
    error_msg: row.errorMsg ?? null,
    duration_ms: row.durationMs,
    run_id: row.runId ?? null,
    prompt_id: row.promptId ?? null,
    meta: row.meta ?? {},
  };

  const { error } = await (sb.from("api_call_logs") as any).insert(payload);
  if (error) {
    console.warn("[cost-tracker] insert failed:", error.message, "for", row.provider, row.operation);
  }
}

// --------------------------------------------------------------------------
// Main wrapper
// --------------------------------------------------------------------------

/**
 * Wrap an async API call. Always returns the original response.
 *
 * @param args  Tracking context (product, operation, user, project, ...)
 * @param fn    The actual API call. Receives no args (closure over your
 *              own variables). Must return the raw provider response.
 */
export async function trackedAICall<T>(
  args: TrackedCallArgs,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let response: T | undefined;
  let status: Status = "success";
  let errorMsg: string | null = null;

  try {
    response = await fn();
    return response;
  } catch (e: any) {
    status = e?.message?.toLowerCase?.().includes("timeout") ? "timeout" : "error";
    errorMsg = (e?.message ?? String(e)).slice(0, 1000);
    throw e;
  } finally {
    const durationMs = Date.now() - start;
    // Log in background so we never delay the caller — but await briefly so
    // serverless functions don't get killed before the insert lands.
    try {
      const usage = response ? extractUsage(args.provider, response) : {
        inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, webSearchCount: 0,
      };
      const costUsd =
        usage.nativeCostUsd ??
        (args.apiModel
          ? args.provider === "openai_embeddings"
            ? computeEmbeddingsCost(args.apiModel, usage.inputTokens)
            : computeLLMCost({
                apiModel: args.apiModel,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cachedInputTokens: usage.cachedInputTokens,
                webSearchCount: usage.webSearchCount,
              })
          : 0);

      // Don't await; let it run after the response is returned. Vercel
      // serverless gives us until function ends; Inngest steps wait for the
      // step to complete so we're safe inside Inngest.
      void insertRow({
        ...args,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        webSearchCount: usage.webSearchCount,
        costUsd: Number(costUsd.toFixed(6)),
        status,
        errorMsg,
        durationMs,
      }).catch((e) => console.warn("[cost-tracker] async insert error:", e));
    } catch (loggingErr) {
      console.warn("[cost-tracker] logging path threw:", loggingErr);
    }
  }
}

/**
 * Manual log helper for non-LLM service calls (DataForSEO, Apify, KG, YouTube)
 * where we already have the cost from the response and don't need usage extraction.
 */
export async function logServiceCall(
  args: TrackedCallArgs & {
    costUsd: number;
    unitCount?: number;
    status?: Status;
    errorMsg?: string | null;
    durationMs: number;
  },
): Promise<void> {
  await insertRow({
    ...args,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    webSearchCount: 0,
    unitCount: args.unitCount ?? 1,
    costUsd: Number(args.costUsd.toFixed(6)),
    status: args.status ?? "success",
    errorMsg: args.errorMsg ?? null,
    durationMs: args.durationMs,
  });
}

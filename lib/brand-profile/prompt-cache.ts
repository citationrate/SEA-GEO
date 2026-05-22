import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { Pillar } from "./prompts";

/**
 * Brand Profile prompt cache — cross-brand reuse for sector+country-only
 * prompts (Recognition #1, Recognition #2, Authority #1, Authority #2).
 *
 * Background: each BP run fires 50 main LLM calls (5 models × 2 prompts ×
 * 5 pillars). Inspection of the prompt templates in `prompts.ts` shows
 * that all Recognition prompts and all Authority prompts are framed
 * around the {sector} + {country} substitution and DO NOT reference the
 * brand at all. The model's answer is therefore identical across two
 * audits of different brands in the same sector — running it again is
 * pure waste.
 *
 * This module exposes (a) `isCacheablePillarPrompt` to decide whether a
 * given (pillar, prompt_index) qualifies and (b) `getOrFetchCached`, a
 * thin wrapper that checks the cache before delegating to the real LLM
 * call. Cache hits avoid the billed API call entirely.
 *
 * TTL is 30 days. Refreshed lazily on miss; expired rows are pruned by
 * a daily cron (`/api/cron/bp-prompt-cache-cleanup`, separate file).
 */

const CACHE_TTL_DAYS = 30;

/**
 * Sector strings are entered as free-form by users ("SaaS", "Saas", "saas
 * software"). To get useful cross-brand reuse the cache key must collapse
 * these casual variants. Lowercase + collapsed whitespace + trim is
 * usually enough; we deliberately do NOT stem or remove punctuation
 * because "Auto sportive di lusso" and "Auto sportive di lusso US" should
 * remain distinct cache entries.
 */
export function normalizeSector(sector: string): string {
  return sector.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Decide whether a given prompt is brand-independent and therefore
 * cacheable across audits. Recognition and Authority pillars are both
 * fully cacheable (every prompt is sector+country only); Clarity,
 * Relevance and Sentiment all reference the brand explicitly in at
 * least one of their prompt templates and are NOT cached.
 *
 * NB: this list is tightly coupled to `prompts.ts::TEMPLATES_IT/EN`.
 * If you add a brand-INSENSITIVE prompt to Clarity/Relevance/Sentiment
 * in the future, extend this function — never the other way around
 * (caching a brand-sensitive prompt produces wrong results).
 */
export function isCacheablePillarPrompt(pillar: Pillar, _promptIndex: number): boolean {
  return pillar === "recognition" || pillar === "authority";
}

function makeCacheKey(args: {
  promptText: string;
  model: string;
  country: string;
  sectorNormalized: string;
}): string {
  const payload = `${args.model}|${args.country}|${args.sectorNormalized}|${args.promptText}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export interface CachedResponse {
  responseRaw: string;
  cacheKey: string;
}

/**
 * Look up the cache for a (prompt_text, model, country, sector) tuple.
 * Returns null on miss or on any DB error (the caller falls back to a
 * live API call, which is the correct fail-open behaviour for a cache).
 */
export async function getCachedPromptResponse(args: {
  promptText: string;
  model: string;
  country: string;
  sector: string;
}): Promise<CachedResponse | null> {
  try {
    const svc = createServiceClient();
    const sectorNormalized = normalizeSector(args.sector);
    const cacheKey = makeCacheKey({ ...args, sectorNormalized });
    const { data, error } = await (svc.schema("brand_profile" as any) as any)
      .from("prompt_cache")
      .select("response_raw, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    // Bump hit counter + last_hit_at (fire-and-forget; if it fails the
    // cache result is still valid, we just lose the telemetry row).
    void (svc.schema("brand_profile" as any) as any)
      .from("prompt_cache")
      .update({ hit_count: (data as any).hit_count + 1, last_hit_at: new Date().toISOString() })
      .eq("cache_key", cacheKey)
      .then(() => {});
    return { responseRaw: data.response_raw as string, cacheKey };
  } catch {
    return null;
  }
}

/**
 * Persist a (prompt, model, country, sector) → response mapping with a
 * 30-day TTL. Idempotent: same cache_key upserts.
 */
export async function setCachedPromptResponse(args: {
  promptText: string;
  model: string;
  country: string;
  sector: string;
  pillar: Pillar;
  responseRaw: string;
}): Promise<void> {
  try {
    const svc = createServiceClient();
    const sectorNormalized = normalizeSector(args.sector);
    const cacheKey = makeCacheKey({ ...args, sectorNormalized });
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
    await (svc.schema("brand_profile" as any) as any)
      .from("prompt_cache")
      .upsert({
        cache_key: cacheKey,
        prompt_text: args.promptText,
        model: args.model,
        country: args.country,
        sector_normalized: sectorNormalized,
        pillar: args.pillar,
        response_raw: args.responseRaw,
        expires_at: expiresAt,
      }, { onConflict: "cache_key" });
  } catch {
    // Cache writes are best-effort; the audit completes either way.
  }
}

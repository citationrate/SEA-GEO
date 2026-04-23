// Isomorphic helpers for resolving plan limits from the unified `plans` table.
//
// Convention: NULL on a numeric limit column means "unlimited" (Enterprise).
// Since our UI/API arithmetic ("remaining = limit - used") can't cope with
// JS Infinity over JSON, we collapse "unlimited" to a large finite sentinel
// and expose `isUnlimitedLimit()` so callers can render "∞" when needed.

export const UNLIMITED_LIMIT = 999_999_999;

export function isUnlimitedLimit(value: number | null | undefined): boolean {
  return typeof value === "number" && value >= UNLIMITED_LIMIT;
}

/**
 * Resolve a possibly-NULL plan limit column to a usable number.
 * - null  → UNLIMITED_LIMIT (Enterprise)
 * - undefined → `fallback` (defensive default if the column is missing)
 * - any other value → Number(value)
 */
export function resolvePlanLimit(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  if (value === null) return UNLIMITED_LIMIT;
  if (value === undefined) return fallback;
  return Number(value);
}

/** True for any plan that should have Pro-tier features (Pro + Enterprise). */
export function isProOrEnterprise(planId: string | null | undefined): boolean {
  return planId === "pro" || planId === "enterprise";
}

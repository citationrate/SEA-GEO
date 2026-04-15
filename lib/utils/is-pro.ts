/**
 * Determine Pro status from profiles.plan column only.
 * Plan is now synced from CitationRate via webhook — no need
 * to check auth.users metadata as a fallback.
 */
export function isProUser(
  profile: { plan?: string } | null,
): boolean {
  const plan = profile?.plan;
  return plan === "pro" || plan === "enterprise";
}

/** Check if user is on the demo (free) plan */
export function isDemoUser(
  profile: { plan?: string } | null,
): boolean {
  const plan = profile?.plan;
  return !plan || plan === "demo";
}

export type EffectivePlan = "demo" | "base" | "pro" | "enterprise";

/** Get effective plan ID */
export function getEffectivePlanId(plan?: string | null): EffectivePlan {
  if (!plan || plan === "demo") return "demo";
  if (plan === "base" || plan === "pro" || plan === "enterprise") return plan;
  return "demo";
}

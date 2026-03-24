/**
 * Determine Pro status from profiles.plan column only.
 * Plan is now synced from CitationRate via webhook — no need
 * to check auth.users metadata as a fallback.
 */
export function isProUser(
  profile: { plan?: string } | null,
): boolean {
  const plan = profile?.plan;
  return plan === "pro" || plan === "agency";
}

/** Check if user is on the demo (free) plan */
export function isDemoUser(
  profile: { plan?: string } | null,
): boolean {
  const plan = profile?.plan;
  return !plan || plan === "demo" || plan === "free";
}

/** Get effective plan ID */
export function getEffectivePlanId(plan?: string | null): "demo" | "base" | "pro" {
  if (!plan || plan === "free" || plan === "demo") return "demo";
  if (plan === "agency") return "pro";
  if (plan === "base" || plan === "pro") return plan;
  return "demo";
}

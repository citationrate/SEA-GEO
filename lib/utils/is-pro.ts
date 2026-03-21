/**
 * Determine Pro status from multiple sources:
 * 1. profiles.plan column ('pro' | 'agency')
 * 2. auth.users raw_user_meta_data { is_pro: true }
 */
export function isProUser(
  profile: { plan?: string } | null,
  userMetadata?: Record<string, any> | null,
): boolean {
  const plan = profile?.plan;
  if (plan === "pro" || plan === "agency") return true;
  if (userMetadata?.is_pro === true) return true;
  return false;
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

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

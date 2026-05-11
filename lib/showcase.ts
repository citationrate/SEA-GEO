/**
 * Showcase plan: manual-grant Enterprise variant for vetrina/demo accounts
 * (Coca-Cola, Heineken, Roche, Leroy Merlin, Mauro Ferraresi, etc.). On the
 * AVI side these accounts have NO access to AVI itself — they only see the
 * Citability Score + Brand Profile entries. The (dashboard) layout redirects
 * them to /brand-profile if they ever land on an AVI route.
 *
 * The whitelist below lets specific email addresses receive the showcase
 * UI gating even when their `plan` is not `enterprise_showcase`. Used for
 * hybrid cases like Antonio Lupi (plan='pro' yearly, bank-transfer, but
 * showcase-style UX). One-off use: keep the list tiny. Migrate to a
 * `profiles.is_showcase` column when it grows past a handful.
 */
export const SHOWCASE_PLAN = "enterprise_showcase";

const SHOWCASE_EMAIL_WHITELIST = new Set<string>([
  "antoniolupi@citationrate.com",
]);

export function isShowcase(plan: string | null | undefined, email?: string | null): boolean {
  if (plan === SHOWCASE_PLAN) return true;
  if (email && SHOWCASE_EMAIL_WHITELIST.has(email.toLowerCase().trim())) return true;
  return false;
}

/**
 * Showcase plan: manual-grant Enterprise variant for vetrina/demo accounts
 * (Coca-Cola, Heineken, Roche, Leroy Merlin, Mauro Ferraresi, etc.). On the
 * AVI side these accounts have NO access to AVI itself — they only see the
 * Citability Score + Brand Profile entries. The (dashboard) layout redirects
 * them to /brand-profile if they ever land on an AVI route.
 */
export const SHOWCASE_PLAN = "enterprise_showcase";

export function isShowcase(plan: string | null | undefined): boolean {
  return plan === SHOWCASE_PLAN;
}

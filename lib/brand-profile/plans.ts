export const BP_RUN_LIMITS: Record<string, number> = {
  demo: 1,
  free: 1,
  base: 3,
  pro: 10,
  agency: 10,
  enterprise: 999,
};

/**
 * Soft-launch whitelist. Brand Profile is hidden from production users until
 * the public launch — only admins (profiles.is_admin = true) and a small set
 * of internal email accounts can reach the (brand-profile) route group or
 * call POST /api/brand-profile/runs.
 *
 * To launch publicly: drop this gate from `(brand-profile)/layout.tsx` and
 * the runs API, and re-add the bp entry to ToolSwitcher TOOLS.
 */
export const BP_WHITELIST_EMAILS: ReadonlySet<string> = new Set([
  "tutorial@citationrate.com",
  "gianmariacipriano3@gmail.com",
  "monzabrianzadascoprire@gmail.com",
  "tecla.casalone@gmail.com",
  "tecla.casalone@studenti.iulm.it",
]);

export function bpAccessAllowed(opts: { email?: string | null; isAdmin?: boolean | null }): boolean {
  if (opts.isAdmin === true) return true;
  const email = (opts.email ?? "").toLowerCase().trim();
  return email !== "" && BP_WHITELIST_EMAILS.has(email);
}

export const BP_MODEL_CAPS: Record<string, number> = {
  demo: 0,
  free: 0,
  base: 3,
  pro: 5,
  agency: 5,
  enterprise: 7,
};

export function bpRunLimit(plan: string | null | undefined): number {
  return BP_RUN_LIMITS[(plan ?? "demo").toLowerCase()] ?? 0;
}

export function bpModelCap(plan: string | null | undefined): number {
  return BP_MODEL_CAPS[(plan ?? "demo").toLowerCase()] ?? 0;
}

const BP_COMPARE_PLANS = new Set(["pro", "agency", "enterprise"]);

export function bpComparePlanAllowed(plan: string | null | undefined): boolean {
  return BP_COMPARE_PLANS.has((plan ?? "demo").toLowerCase());
}

export const BP_COMPARE_MIN_RUNS = 2;
export const BP_COMPARE_MAX_RUNS = 4;

const BP_HISTORY_PLANS = new Set(["base", "pro", "agency", "enterprise"]);

export function bpHistoryPlanAllowed(plan: string | null | undefined): boolean {
  return BP_HISTORY_PLANS.has((plan ?? "demo").toLowerCase());
}

export function bpTimeSeriesAllowed(plan: string | null | undefined): boolean {
  return (plan ?? "demo").toLowerCase() === "enterprise";
}

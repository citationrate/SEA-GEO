export const BP_RUN_LIMITS: Record<string, number> = {
  demo: 0,
  free: 0,
  base: 1,
  pro: 3,
  agency: 3,
  enterprise: 999,
};

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

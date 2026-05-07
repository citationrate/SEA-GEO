/**
 * Brand Profile extra-runs packs.
 *
 * One-time purchases that top up a user's `brand_profile_extra_runs_balance`
 * (carry-over, doesn't reset monthly). Each Stripe Price ID is read from an
 * env var; the pack id is the metadata key on the checkout session and the
 * stable identifier the frontend uses to request a checkout.
 *
 * Pricing rationale: BP runtime cost is ~€0.14/run (Haiku + Perplexity Sonar),
 * so all packs keep gross margin >96%. Per-run prices decrease with pack size
 * to incentivize larger purchases, and the largest Pro pack tilts the math
 * toward Enterprise once a user buys it twice in a month.
 */
export type BpExtraPlanScope = "base" | "pro";

export interface BpExtraPack {
  /** Stable identifier. Stored as Stripe metadata.pack_id and in the ledger. */
  id: string;
  /** Plan that is allowed to buy this pack (single-plan scope by design). */
  plan: BpExtraPlanScope;
  /** Number of runs added to brand_profile_extra_runs_balance on credit. */
  runs: number;
  /** Display price in cents (EUR). Matches the corresponding Stripe Price. */
  priceCents: number;
  /** Env var holding the Stripe Price ID. */
  envKey: string;
}

export const BP_EXTRA_PACKS: Record<string, BpExtraPack> = {
  base_3: {
    id: "base_3",
    plan: "base",
    runs: 3,
    priceCents: 1900,
    envKey: "STRIPE_PRICE_BP_EXTRA_BASE_3",
  },
  base_10: {
    id: "base_10",
    plan: "base",
    runs: 10,
    priceCents: 4900,
    envKey: "STRIPE_PRICE_BP_EXTRA_BASE_10",
  },
  pro_5: {
    id: "pro_5",
    plan: "pro",
    runs: 5,
    priceCents: 2900,
    envKey: "STRIPE_PRICE_BP_EXTRA_PRO_5",
  },
  pro_15: {
    id: "pro_15",
    plan: "pro",
    runs: 15,
    priceCents: 6900,
    envKey: "STRIPE_PRICE_BP_EXTRA_PRO_15",
  },
  pro_30: {
    id: "pro_30",
    plan: "pro",
    runs: 30,
    priceCents: 11900,
    envKey: "STRIPE_PRICE_BP_EXTRA_PRO_30",
  },
};

export function getBpExtraPack(id: string): BpExtraPack | null {
  return BP_EXTRA_PACKS[id] ?? null;
}

export function bpExtraPriceIdFromPack(pack: BpExtraPack): string | null {
  return process.env[pack.envKey]?.trim() || null;
}

/**
 * Reverse lookup: given a Stripe Price ID, return the pack it matches. Used
 * by the webhook to authoritatively credit the right number of runs (rather
 * than trusting the metadata.runs field, which the client could tamper with
 * via metadata override).
 */
export function bpPackFromPriceId(priceId: string): BpExtraPack | null {
  for (const pack of Object.values(BP_EXTRA_PACKS)) {
    if (process.env[pack.envKey]?.trim() === priceId) return pack;
  }
  return null;
}

/** Packs visible to a given plan in /brand-profile/piano. */
export function bpPacksForPlan(plan: string): BpExtraPack[] {
  const p = plan.toLowerCase();
  if (p === "base") return [BP_EXTRA_PACKS.base_3, BP_EXTRA_PACKS.base_10];
  if (p === "pro") return [BP_EXTRA_PACKS.pro_5, BP_EXTRA_PACKS.pro_15, BP_EXTRA_PACKS.pro_30];
  // demo/free/enterprise/agency: no extra packs (demo upgrades to Base, enterprise is unlimited)
  return [];
}

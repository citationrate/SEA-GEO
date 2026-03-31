import Stripe from "stripe";

/* ─── Lazy Stripe instance (avoids crash at build time when env is missing) ─── */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY env var");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

/* ─── Price → Plan mapping ─── */

export function planFromPriceId(priceId: string) {
  const map: Record<string, { plan: "base" | "pro"; period: "monthly" | "yearly" }> = {
    [process.env.STRIPE_PRICE_BASE_MONTHLY || ""]: { plan: "base", period: "monthly" },
    [process.env.STRIPE_PRICE_BASE_YEARLY || ""]: { plan: "base", period: "yearly" },
    [process.env.STRIPE_PRICE_PRO_MONTHLY || ""]: { plan: "pro", period: "monthly" },
    [process.env.STRIPE_PRICE_PRO_YEARLY || ""]: { plan: "pro", period: "yearly" },
  };
  return map[priceId] ?? null;
}

/* ─── Package price IDs (one-time) ─── */

function getPackagePrices(): Set<string> {
  return new Set([
    // AVI packages
    process.env.STRIPE_PRICE_QUERIES_BASE_100,
    process.env.STRIPE_PRICE_QUERIES_BASE_300,
    process.env.STRIPE_PRICE_QUERIES_PRO_100,
    process.env.STRIPE_PRICE_QUERIES_PRO_300,
    process.env.STRIPE_PRICE_CONFRONTI_3,
    process.env.STRIPE_PRICE_CONFRONTI_5,
    process.env.STRIPE_PRICE_CONFRONTI_10,
    // CitationRate packages
    process.env.STRIPE_PRICE_CR_EXTRA_5,
    process.env.STRIPE_PRICE_CR_EXTRA_10,
    process.env.STRIPE_PRICE_CR_EXTRA_UNLOCK,
  ].filter(Boolean) as string[]);
}

export function isPackagePrice(priceId: string) {
  return getPackagePrices().has(priceId);
}

export function packageDetailsFromPriceId(priceId: string) {
  const map: Record<string, { queries_added: number; package_type: string; platform: "avi" | "citationrate" }> = {
    // AVI packages
    [process.env.STRIPE_PRICE_QUERIES_BASE_100 || ""]: { queries_added: 100, package_type: "queries_base_100", platform: "avi" },
    [process.env.STRIPE_PRICE_QUERIES_BASE_300 || ""]: { queries_added: 300, package_type: "queries_base_300", platform: "avi" },
    [process.env.STRIPE_PRICE_QUERIES_PRO_100 || ""]: { queries_added: 100, package_type: "queries_pro_100", platform: "avi" },
    [process.env.STRIPE_PRICE_QUERIES_PRO_300 || ""]: { queries_added: 300, package_type: "queries_pro_300", platform: "avi" },
    [process.env.STRIPE_PRICE_CONFRONTI_3 || ""]: { queries_added: 3, package_type: "confronti_3", platform: "avi" },
    [process.env.STRIPE_PRICE_CONFRONTI_5 || ""]: { queries_added: 5, package_type: "confronti_5", platform: "avi" },
    [process.env.STRIPE_PRICE_CONFRONTI_10 || ""]: { queries_added: 10, package_type: "confronti_10", platform: "avi" },
    // CitationRate packages
    [process.env.STRIPE_PRICE_CR_EXTRA_5 || ""]: { queries_added: 5, package_type: "cr_extra_5", platform: "citationrate" },
    [process.env.STRIPE_PRICE_CR_EXTRA_10 || ""]: { queries_added: 10, package_type: "cr_extra_10", platform: "citationrate" },
    [process.env.STRIPE_PRICE_CR_EXTRA_UNLOCK || ""]: { queries_added: 1, package_type: "cr_extra_unlock", platform: "citationrate" },
  };
  return map[priceId] ?? null;
}

/* ─── Checkout helpers ─── */

export async function createSubscriptionCheckout(
  userId: string,
  customerEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  stripeCustomerId?: string,
) {
  const stripe = getStripe();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: userId },
    subscription_data: { metadata: { user_id: userId } },
  };
  if (stripeCustomerId) params.customer = stripeCustomerId;
  else params.customer_email = customerEmail;
  return stripe.checkout.sessions.create(params);
}

export async function createOneTimeCheckout(
  userId: string,
  customerEmail: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  stripeCustomerId?: string,
) {
  const stripe = getStripe();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: userId },
  };
  if (stripeCustomerId) params.customer = stripeCustomerId;
  else params.customer_email = customerEmail;
  return stripe.checkout.sessions.create(params);
}

/* ─── Subscription management ─── */

export async function cancelSubscription(subscriptionId: string) {
  return getStripe().subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string) {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

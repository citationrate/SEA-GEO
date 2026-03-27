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
  const map: Record<string, { plan: "pro" | "agency"; period: "monthly" | "yearly" }> = {
    [process.env.STRIPE_PRICE_BASE_MONTHLY || ""]: { plan: "pro", period: "monthly" },
    [process.env.STRIPE_PRICE_BASE_YEARLY || ""]: { plan: "pro", period: "yearly" },
    [process.env.STRIPE_PRICE_PRO_MONTHLY || ""]: { plan: "agency", period: "monthly" },
    [process.env.STRIPE_PRICE_PRO_YEARLY || ""]: { plan: "agency", period: "yearly" },
  };
  return map[priceId] ?? null;
}

/* ─── Package price IDs (one-time) ─── */

function getPackagePrices(): Set<string> {
  return new Set([
    process.env.STRIPE_PRICE_QUERIES_BASE_100,
    process.env.STRIPE_PRICE_QUERIES_BASE_300,
    process.env.STRIPE_PRICE_QUERIES_PRO_100,
    process.env.STRIPE_PRICE_QUERIES_PRO_300,
    process.env.STRIPE_PRICE_CONFRONTI_3,
    process.env.STRIPE_PRICE_CONFRONTI_5,
    process.env.STRIPE_PRICE_CONFRONTI_10,
  ].filter(Boolean) as string[]);
}

export function isPackagePrice(priceId: string) {
  return getPackagePrices().has(priceId);
}

export function packageDetailsFromPriceId(priceId: string) {
  const map: Record<string, { queries_added: number; package_type: string }> = {
    [process.env.STRIPE_PRICE_QUERIES_BASE_100 || ""]: { queries_added: 100, package_type: "queries_base_100" },
    [process.env.STRIPE_PRICE_QUERIES_BASE_300 || ""]: { queries_added: 300, package_type: "queries_base_300" },
    [process.env.STRIPE_PRICE_QUERIES_PRO_100 || ""]: { queries_added: 100, package_type: "queries_pro_100" },
    [process.env.STRIPE_PRICE_QUERIES_PRO_300 || ""]: { queries_added: 300, package_type: "queries_pro_300" },
    [process.env.STRIPE_PRICE_CONFRONTI_3 || ""]: { queries_added: 3, package_type: "confronti_3" },
    [process.env.STRIPE_PRICE_CONFRONTI_5 || ""]: { queries_added: 5, package_type: "confronti_5" },
    [process.env.STRIPE_PRICE_CONFRONTI_10 || ""]: { queries_added: 10, package_type: "confronti_10" },
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

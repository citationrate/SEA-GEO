import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUsage } from "@/lib/usage";
import { PianoClient } from "./piano-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piano — AVI" };

/** CitationRate project — has billing columns */
function getCitationRateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function PianoPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();

  // Profile — read plan from seageo1
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;
  const plan = p.plan ?? "demo";

  // Billing data — read from CitationRate (has stripe_subscription_id, subscription_status, etc.)
  const cr = getCitationRateClient();
  let billing: any = {};
  if (cr) {
    const { data: crProfile } = await cr.from("profiles")
      .select("subscription_status, subscription_period, stripe_subscription_id, stripe_customer_id, paypal_subscription_id")
      .eq("id", user.id)
      .single();
    billing = crProfile ?? {};
  }

  // Usage
  const usage = await getCurrentUsage(user.id);

  return (
    <PianoClient
      plan={plan}
      subscriptionStatus={billing.subscription_status || "inactive"}
      subscriptionPeriod={billing.subscription_period || null}
      hasActiveSubscription={!!(billing.stripe_subscription_id || billing.paypal_subscription_id)}
      browsingUsed={usage.browsingPromptsUsed}
      noBrowsingUsed={usage.noBrowsingPromptsUsed}
      comparisonsUsed={usage.comparisonsUsed}
      extraBrowsing={usage.extraBrowsingPrompts}
      extraNoBrowsing={usage.extraNoBrowsingPrompts}
      extraComparisons={usage.extraComparisons}
    />
  );
}

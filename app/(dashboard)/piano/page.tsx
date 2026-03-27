import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { getCurrentUsage } from "@/lib/usage";
import { PianoClient } from "./piano-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piano — AVI" };

export default async function PianoPage() {
  const auth = createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();

  // Profile
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("plan, subscription_status, subscription_period, stripe_subscription_id, paypal_subscription_id")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as any;
  const plan = p.plan ?? "demo";

  // Usage
  const usage = await getCurrentUsage(user.id);

  return (
    <PianoClient
      plan={plan}
      subscriptionStatus={p.subscription_status || "inactive"}
      subscriptionPeriod={p.subscription_period || null}
      hasActiveSubscription={!!(p.stripe_subscription_id || p.paypal_subscription_id)}
      browsingUsed={usage.browsingPromptsUsed}
      noBrowsingUsed={usage.noBrowsingPromptsUsed}
      comparisonsUsed={usage.comparisonsUsed}
      extraBrowsing={usage.extraBrowsingPrompts}
      extraNoBrowsing={usage.extraNoBrowsingPrompts}
      extraComparisons={usage.extraComparisons}
    />
  );
}

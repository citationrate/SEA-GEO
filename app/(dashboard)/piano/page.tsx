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

  // Profile — read from seageo1
  const { data: profile, error: profileErr } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileErr) {
    console.error("[piano] Profile fetch error:", profileErr.message);
  }

  const p = (profile ?? {}) as any;
  const plan = p.plan ?? "demo";
  console.log("[piano] User plan from seageo1:", plan, "user:", user.id);

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

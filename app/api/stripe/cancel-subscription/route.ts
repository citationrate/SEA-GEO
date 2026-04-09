import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { cancelSubscription } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";

function getCitationRateClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CITATIONRATE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing CitationRate env vars");
  return createClient(url, key);
}

export async function POST() {
  try {
    const { supabase, user, error } = await requireAuth();
    if (error) return error;

    // Get stripe_subscription_id — try seageo1 first, fallback to CitationRate
    // (the suite webhook writes it to CR, the AVI webhook used to write it to
    // seageo1 but that handler was removed during unification)
    const { data: sgProfile } = await (supabase!.from("profiles") as any)
      .select("stripe_subscription_id")
      .eq("id", user!.id)
      .single();
    let subId = sgProfile?.stripe_subscription_id;

    if (!subId) {
      const cr = getCitationRateClient();
      const { data: crProfile } = await cr.from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user!.id)
        .single();
      subId = (crProfile as any)?.stripe_subscription_id;
    }

    // If there's a Stripe subscription, cancel it on Stripe first.
    // Voucher-upgraded users have no subscription — skip Stripe call.
    if (subId) {
      await cancelSubscription(subId);
    }

    // Revert to demo on CitationRate
    try {
      const cr = getCitationRateClient();
      await cr.from("profiles").update({
        plan: "demo",
        subscription_status: "inactive",
        subscription_period: null,
        stripe_subscription_id: null,
      } as any).eq("id", user!.id);
    } catch (err: any) {
      console.error("[cancel-subscription] CitationRate update error:", err.message);
    }

    // Revert to demo on seageo1
    await (supabase!.from("profiles") as any).update({
      plan: "demo",
      subscription_status: "inactive",
      subscription_period: null,
      stripe_subscription_id: null,
    }).eq("id", user!.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[cancel-subscription]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

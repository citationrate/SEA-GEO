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

    // Get stripe_subscription_id from seageo1 profiles
    const { data: profile } = await (supabase!.from("profiles") as any)
      .select("stripe_subscription_id")
      .eq("id", user!.id)
      .single();
    const subId = profile?.stripe_subscription_id;

    if (!subId) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    // Cancel on Stripe (cancels at period end by default)
    await cancelSubscription(subId);

    // Update status on CitationRate
    try {
      const cr = getCitationRateClient();
      await cr.from("profiles").update({
        subscription_status: "cancelled",
      } as any).eq("id", user!.id);
    } catch (err: any) {
      console.error("[cancel-subscription] CitationRate update error:", err.message);
    }

    // Also update seageo1
    await (supabase!.from("profiles") as any).update({
      subscription_status: "cancelled",
    }).eq("id", user!.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[cancel-subscription]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

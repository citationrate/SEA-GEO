import { requireAuth } from "@/lib/api-helpers";
import { cancelSubscription } from "@/lib/paypal";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const cr = createCitationRateServiceClient();

    // Get user's subscription ID from CitationRate profiles
    const { data: profile } = await (cr.from("profiles") as any)
      .select("paypal_subscription_id, subscription_status")
      .eq("id", user.id)
      .single();

    if (!profile?.paypal_subscription_id) {
      return NextResponse.json({ error: "Nessun abbonamento attivo trovato" }, { status: 404 });
    }

    if (profile.subscription_status === "cancelled") {
      return NextResponse.json({ error: "Abbonamento già cancellato" }, { status: 400 });
    }

    // Cancel on PayPal
    await cancelSubscription(profile.paypal_subscription_id);

    // Update CitationRate profiles
    await (cr.from("profiles") as any)
      .update({
        subscription_status: "cancelled",
        plan: "demo",
      })
      .eq("id", user.id);

    // Also update seageo1 directly (don't wait for webhook sync)
    const svc = createServiceClient();
    await (svc.from("profiles") as any)
      .update({ plan: "demo" })
      .eq("id", user.id);

    console.log("[cancel-subscription] Cancelled:", user.id, "sub:", profile.paypal_subscription_id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[paypal/cancel-subscription] error:", err?.message ?? err);
    return NextResponse.json({ error: "Errore nella cancellazione", detail: err?.message }, { status: 500 });
  }
}

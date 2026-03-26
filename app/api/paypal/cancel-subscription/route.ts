import { requireAuth } from "@/lib/api-helpers";
import { cancelSubscription } from "@/lib/paypal";
import { createCitationRateServiceClient } from "@/lib/supabase/citationrate-service";
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

    // Update CitationRate profiles — the existing Supabase webhook will sync to AVI
    await (cr.from("profiles") as any)
      .update({
        subscription_status: "cancelled",
        plan: "demo",
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[paypal/cancel-subscription] error:", err);
    return NextResponse.json({ error: "Errore nella cancellazione" }, { status: 500 });
  }
}
